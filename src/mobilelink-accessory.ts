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
    public readonly platform: MobileLinkPlatform,
    public readonly accessory: PlatformAccessory,
  ) {
    this.status = this.accessory.context.status;
    this.log = this.platform.log;

    // set accessory information
    this.getService(this.Service.AccessoryInformation)!
      .setCharacteristic(this.Characteristic.Manufacturer, DEFAULT_MANUFACTURER_NAME)
      .setCharacteristic(this.Characteristic.Model, this.status.GeneratorModel)
      .setCharacteristic(this.Characteristic.SerialNumber, this.status.GeneratorSerialNumber)
      .setCharacteristic(this.Characteristic.FirmwareRevision, this.status.FirmwareVersion);

    this.service = this.getService(this.Service.Outlet);
    this.batteryService = this.getService(this.Service.BatteryService);
    this.bridgingStateService = this.getService(this.Service.BridgingState);

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
   * Returns the service if it exists, otherwise create a new Outlet service.
   */
  getService(service): Service {
    return this.accessory.getService(service) || this.accessory.addService(service);
  }

  /**
   * Returns a valid battery status based on the latest voltage reading.
   */
  getBatteryStatus(): CharacteristicValue {
    return /good/i.test(this.status.BatteryVoltage)
      ? this.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
      : this.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
  }

  getBatteryLevel() {
    if (this.hasServiceFault()) {
      throw new Error(RED_LIGHT_ERROR_MESSAGE);
    }

    const isBatteryStatusNormal = this.getBatteryStatus() === this.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

    return isBatteryStatusNormal ? 100 : 0;
  }

  getChargingState() {
    if (this.hasServiceFault()) {
      throw new Error(RED_LIGHT_ERROR_MESSAGE);
    }

    return this.status.Connected
      ? this.Characteristic.ChargingState.CHARGING
      : this.Characteristic.ChargingState.NOT_CHARGING;
  }

  /**
   * Returns true if the generator is currently running.
   * 
   * The blue light being lit means the generator is currently running.
   */
  isRunning(): boolean {
    if (this.hasServiceFault()) {
      throw new Error(RED_LIGHT_ERROR_MESSAGE);
    }

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

  updateStatus(newStatus: MobileLinkGeneratorStatus) {
    const hasChanged = (this.status.Connected !== newStatus.Connected) || (this.status.FirmwareVersion !== newStatus.FirmwareVersion) ||
      (this.status.BlueLightLit !== newStatus.BlueLightLit) || (this.status.GreenLightLit !== newStatus.GreenLightLit) ||
      (this.status.RedLightLit !== newStatus.RedLightLit) || (this.status.YellowLightLit !== newStatus.YellowLightLit) ||
      (this.status.SignalStrength !== newStatus.SignalStrength) || (this.status.BatteryVoltage !== newStatus.BatteryVoltage);

    this.status = newStatus;
    this.accessory.context.status = newStatus;

    if (hasChanged) {
      this.log.info('%s - Detected status change, updating characteristics', this.status.GeneratorName);
      try {
        this.getService(this.Service.AccessoryInformation)!
          .getCharacteristic(this.Characteristic.FirmwareRevision)
          .updateValue(this.status.FirmwareVersion);

        this.service.getCharacteristic(this.Characteristic.On).updateValue(this.isOn());
        this.service.getCharacteristic(this.Characteristic.OutletInUse).updateValue(this.isRunning());

        this.batteryService.getCharacteristic(this.Characteristic.BatteryLevel).updateValue(this.getBatteryLevel());
        this.batteryService.getCharacteristic(this.Characteristic.ChargingState).updateValue(this.getChargingState());
        this.batteryService.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(this.getBatteryStatus());

        this.bridgingStateService.getCharacteristic(this.Characteristic.Reachable).updateValue(this.status.Connected);
        this.bridgingStateService.getCharacteristic(this.Characteristic.LinkQuality).updateValue(this.getLinkQuality());
      } catch (err) {
        this.log.error('Could not update status: %s', err.stack || err.message);
      }
    }
  }

  isOn() {
    if (this.hasServiceFault()) {
      throw new Error(RED_LIGHT_ERROR_MESSAGE);
    }

    return this.isReady();
  }

  getLinkQuality() {
    const linkQuality = Math.ceil((Math.abs(Number(this.status.SignalStrength)) / 100) * 4);

    return Math.min(linkQuality, 4);
  }

  /**
   * Handle requests to get the current value of the "Active" characteristic
   */
  private handleOnGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET On');

    try {
      return callback(null, this.isOn());
    } catch (err) {
      return callback(err);
    }
  }

  /**
   * Handle requests to set the "Active" characteristic
   */
  private handleOnSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
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
  private handleOutletInUseGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET OutletInUse');

    try {
      return callback(null, this.isRunning());
    } catch (err) {
      return callback(err);
    }
  }

  /**
  * Handle requests to get the current value of the "Battery Level" characteristic
  */
  private handleBatteryLevelGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET BatteryLevel');

    try {
      return callback(null, this.getBatteryLevel());
    } catch (err) {
      return callback(err);
    }
  }

  /**
   * Handle requests to get the current value of the "Charging State" characteristic
   */
  private handleChargingStateGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET ChargingState');

    try {
      return callback(null, this.getChargingState());
    } catch (err) {
      return callback(err);
    }
  }

  /**
   * Handle requests to get the current value of the "Status Low Battery" characteristic
   */
  private handleStatusLowBatteryGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET StatusLowBattery');

    callback(null, this.getBatteryStatus());
  }

  /**
   * Handle requests to get the current value of the "Reachable" characteristic
   */
  private handleReachableGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET Reachable');

    callback(null, this.status.Connected);
  }

  /**
   * Handle requests to get the current value of the "Link Quality" characteristic
   */
  private handleLinkQualityGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET LinkQuality');

    callback(null, this.getLinkQuality());
  }

  /**
   * Handle requests to get the current value of the "Accessory Identifier" characteristic
   */
  private handleAccessoryIdentifierGet(callback) {
    this.log.debug('Triggered GET AccessoryIdentifier');

    callback(null, String(this.status.GensetID));
  }

  /**
   * Handle requests to get the current value of the "Category" characteristic
   */
  private handleCategoryGet(callback: CharacteristicGetCallback) {
    this.log.debug('Triggered GET Category');

    // set this to a valid value for Category
    const currentValue = 1;

    callback(null, currentValue);
  }
}
