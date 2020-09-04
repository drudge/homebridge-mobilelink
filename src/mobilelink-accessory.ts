import {
  Characteristic,
  CharacteristicValue,
  CharacteristicSetCallback,
  CharacteristicGetCallback,
  Logger,
  PlatformAccessory,
  Service,
} from 'homebridge';

import { MobileLinkPlatform } from './mobilelink-platform';
import { DEFAULT_MANUFACTURER_NAME } from './settings';
import { MobileLinkGeneratorStatus } from './types';

const RED_LIGHT_ERROR_MESSAGE = 'Your generator has either experienced a fault or has been switched to OFF.';

/**
 * Mobile Link Accessory
 * An instance of this class is created for each accessory the platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class MobileLinkAccessory {
  public readonly Service: typeof Service = this.platform.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.platform.api.hap.Characteristic;

  private service: Service;
  private batteryService: Service;
  private bridgingStateService: Service;

  private status: MobileLinkGeneratorStatus;
  private readonly log: Logger;

  constructor(
    private readonly platform: MobileLinkPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.status = this.accessory.context.status;
    this.log = this.platform.log;

    // set accessory information
    this.accessory.getService(this.Service.AccessoryInformation)!
      .setCharacteristic(this.Characteristic.Manufacturer, DEFAULT_MANUFACTURER_NAME)
      .setCharacteristic(this.Characteristic.Model, this.status.GeneratorModel)
      .setCharacteristic(this.Characteristic.SerialNumber, this.status.GeneratorSerialNumber)
      .setCharacteristic(this.Characteristic.FirmwareRevision, this.status.FirmwareVersion);

    // get the Outlet service if it exists, otherwise create a new Outlet service
    // you can create multiple services for each accessory
    const getService = this.accessory.getService;
    const addService = this.accessory.addService;

    this.service = getService(this.Service.Outlet) || addService(this.Service.Outlet);
    this.batteryService = getService(this.Service.BatteryService) || addService(this.Service.BatteryService);
    this.bridgingStateService = getService(this.Service.BridgingState) || addService(this.Service.BridgingState);

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.Characteristic.Name, this.status.GeneratorName);

    // each service must implement at-minimum the "required characteristics" for the given service type

    // see https://developers.homebridge.io/#/service/Outlet
    this.service.getCharacteristic(this.Characteristic.On)
      .once('get', this.handleOnGet.bind(this))
      .once('set', this.handleOnSet.bind(this));

    this.service.getCharacteristic(this.Characteristic.OutletInUse)
      .once('get', this.handleOutletInUseGet.bind(this));

    // see https://developers.homebridge.io/#/service/BatteryService
    this.batteryService.getCharacteristic(this.Characteristic.BatteryLevel)
      .once('get', this.handleBatteryLevelGet.bind(this));

    this.batteryService.getCharacteristic(this.Characteristic.ChargingState)
      .once('get', this.handleChargingStateGet.bind(this));

    this.batteryService.getCharacteristic(this.Characteristic.StatusLowBattery)
      .once('get', this.handleStatusLowBatteryGet.bind(this));

    // see https://developers.homebridge.io/#/service/BridgingState
    this.bridgingStateService.getCharacteristic(this.Characteristic.Reachable)
      .on('get', this.handleReachableGet.bind(this));

    this.bridgingStateService.getCharacteristic(this.Characteristic.LinkQuality)
      .on('get', this.handleLinkQualityGet.bind(this));

    this.bridgingStateService.getCharacteristic(this.Characteristic.AccessoryIdentifier)
      .on('get', this.handleAccessoryIdentifierGet.bind(this));

    this.bridgingStateService.getCharacteristic(this.Characteristic.Category)
      .on('get', this.handleCategoryGet.bind(this));
  }

  /**
   * Returns true if the generator is currently running.
   * 
   * The blue light being lit means the generator is currently running.
   */
  isRunning(): boolean {
    return this.status.BlueLightLit;
  }

  /**
   * Returns true if the generator is not operational.
   * 
   * This means the generator has either experienced a fault or has been switched to OFF.
   */
  hasServiceFault(): boolean {
    return this.status.RedLightLit;
  }

  /**
   * Returns true if the generator is operational.
   * 
   * The yellow light being lit means generator needs maintenance or has a warning, but will still run in the event of an outage.
   */
  isReady(): boolean {
    return this.status.GreenLightLit || this.status.YellowLightLit;
  }

  /**
   * Handle requests to get the current value of the "Active" characteristic
   */
  handleOnGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET On');

    if (this.hasServiceFault()) {
      return callback(new Error(RED_LIGHT_ERROR_MESSAGE));
    }

    callback(null, this.isReady());
  }

  /**
   * Handle requests to set the "Active" characteristic
   */
  handleOnSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    //TODO: Handle starting/stopping the generator

    this.log.debug('Triggered SET Active:' + value);

    if (this.hasServiceFault()) {
      return callback(new Error(RED_LIGHT_ERROR_MESSAGE));
    }

    return callback(new Error(RED_LIGHT_ERROR_MESSAGE));

    callback(null);
  }

  /**
   * Handle requests to get the current value of the "In Use" characteristic
   */
  handleOutletInUseGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET OutletInUse');

    if (this.hasServiceFault()) {
      return callback(new Error(RED_LIGHT_ERROR_MESSAGE));
    }

    callback(null, this.isRunning());
  }

  /**
  * Handle requests to get the current value of the "Battery Level" characteristic
  */
  handleBatteryLevelGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET BatteryLevel');

    if (this.hasServiceFault()) {
      return callback(new Error(RED_LIGHT_ERROR_MESSAGE));
    }

    callback(null, this.status.Connected ? 100 : 0);
  }

  /**
   * Handle requests to get the current value of the "Charging State" characteristic
   */
  handleChargingStateGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET ChargingState');

    if (this.hasServiceFault()) {
      return callback(new Error(RED_LIGHT_ERROR_MESSAGE));
    }

    // set this to a valid value for ChargingState
    const currentValue = this.status.Connected
      ? this.Characteristic.ChargingState.CHARGING
      : this.Characteristic.ChargingState.NOT_CHARGING;

    callback(null, currentValue);
  }

  /**
   * Handle requests to get the current value of the "Status Low Battery" characteristic
   */
  handleStatusLowBatteryGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET StatusLowBattery');

    // set this to a valid value for StatusLowBattery
    const currentValue = /good/i.test(this.status.BatteryVoltage)
      ? this.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
      : this.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;

    callback(null, currentValue);
  }

  /**
   * Handle requests to get the current value of the "Reachable" characteristic
   */
  handleReachableGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET Reachable');

    callback(null, this.status.Connected);
  }

  /**
   * Handle requests to get the current value of the "Link Quality" characteristic
   */
  handleLinkQualityGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET LinkQuality');

    const linkQuality = Math.ceil((Math.abs(Number(this.status.SignalStrength)) / 100) * 4);

    callback(null, Math.min(linkQuality, 4));
  }

  /**
   * Handle requests to get the current value of the "Accessory Identifier" characteristic
   */
  handleAccessoryIdentifierGet(callback) {
    this.log.debug('Triggered GET AccessoryIdentifier');

    callback(null, String(this.status.GensetID));
  }

  /**
   * Handle requests to get the current value of the "Category" characteristic
   */
  handleCategoryGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET Category');

    // set this to a valid value for Category
    const currentValue = 1;

    callback(null, currentValue);
  }
}
