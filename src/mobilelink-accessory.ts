import {
  Characteristic,
  CharacteristicValue,
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
  private infoService: Service;

  private status: MobileLinkGeneratorStatus;
  private readonly log: Logger;

  constructor(
    private readonly platform: MobileLinkPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.log = this.platform.log;
    this.status = this.accessory.context.status;

    this.service = this.getService(this.Service.Outlet);
    this.infoService = this.getService(this.Service.AccessoryInformation);
    this.batteryService = this.getService(this.Service.BatteryService);
    this.bridgingStateService = this.getService(this.Service.BridgingState);

    this.updateStatus(this.status, true);
  }

  /**
   * Returns the display name of the device.
   */
  displayName() {
    return this.accessory.displayName;
  }

  /**
   * Returns the platform accessory.
   */
  getPlatformAccessory(): PlatformAccessory {
    return this.accessory;
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

  /**
   * Returns a valid battery level based on the latest voltage reading.
   */
  getBatteryLevel() {
    const isBatteryStatusNormal = this.getBatteryStatus() === this.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

    return isBatteryStatusNormal ? 100 : 0;
  }

  /**
   * Returns a valid charging state based on a generator being connected.
   */
  getChargingState() {
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
   * Returns true if the generator is operational.
   * 
   * The red light being lit means the generator has either experienced a fault or has been switched to OFF.
   * The yellow light being lit means generator needs maintenance or has a warning, but will still run in the event of an outage.
   */
  isOn() {
    if (this.hasServiceFault()) {
      throw new Error(RED_LIGHT_ERROR_MESSAGE);
    }

    return this.isReady();
  }

  /**
   * Returns a value between 1 and 4 to indicate signal strength of the WiFi connection.
   */
  getLinkQuality() {
    const linkQuality = Math.ceil((Math.abs(Number(this.status.SignalStrength)) / 100) * 4);

    return Math.min(linkQuality, 4);
  }

  /**
   * Detect status changes and update service characteristics.
   */
  updateStatus(newStatus: MobileLinkGeneratorStatus, force = false) {
    const hasChanged = !this.status || ((this.status.Connected !== newStatus.Connected) || 
      (this.status.FirmwareVersion !== newStatus.FirmwareVersion) || (this.status.BlueLightLit !== newStatus.BlueLightLit) || 
      (this.status.GreenLightLit !== newStatus.GreenLightLit) || (this.status.RedLightLit !== newStatus.RedLightLit) || 
      (this.status.YellowLightLit !== newStatus.YellowLightLit) || (this.status.SignalStrength !== newStatus.SignalStrength) || 
      (this.status.BatteryVoltage !== newStatus.BatteryVoltage));

    this.status = newStatus;
    this.accessory.context.status = newStatus;

    if (hasChanged || force) {
      !force && this.log.info('%s: Detected status change, updating characteristics', this.status.GeneratorName);

      try {
        this.service.getCharacteristic(this.Characteristic.Name).updateValue(this.status.GeneratorName);
        this.service.getCharacteristic(this.Characteristic.On).updateValue(this.isReady());
        this.service.getCharacteristic(this.Characteristic.OutletInUse).updateValue(this.isRunning());

        this.batteryService.getCharacteristic(this.Characteristic.BatteryLevel).updateValue(this.getBatteryLevel());
        this.batteryService.getCharacteristic(this.Characteristic.ChargingState).updateValue(this.getChargingState());
        this.batteryService.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(this.getBatteryStatus());

        this.bridgingStateService.getCharacteristic(this.Characteristic.Reachable).updateValue(this.status.Connected);
        this.bridgingStateService.getCharacteristic(this.Characteristic.LinkQuality).updateValue(this.getLinkQuality());
        
        this.infoService.getCharacteristic(this.Characteristic.Manufacturer).updateValue(DEFAULT_MANUFACTURER_NAME);
        this.infoService.getCharacteristic(this.Characteristic.Model).updateValue(this.status.GeneratorModel);
        this.infoService.getCharacteristic(this.Characteristic.FirmwareRevision).updateValue(this.status.FirmwareVersion);
      } catch (err) {
        this.log.error('Could not update status: %s', err.stack || err.message);
      }
    }
  }
}
