import {
  API, 
  Characteristic,
  DynamicPlatformPlugin, 
  Logger, 
  PlatformAccessory, 
  PlatformConfig, 
  Service, 
} from 'homebridge';
import Got from 'got';

import { MobileLinkAccessory } from './mobilelink-accessory';
import { 
  MOBILE_LINK_API_URL,
  MOBILE_LINK_API_USER_AGENT,
  PLATFORM_NAME,
  PLUGIN_NAME,
} from './settings';
import { MobileLinkGeneratorStatus } from './types';

/**
 * MobileLinkPlatform
 * This class is the main constructor for the plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class MobileLinkPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public mlapi: typeof Got = Got;

  private isDiscovering = false;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    process.on('uncaughtException', (err) => {
      this.log.error(err.stack || err.message);
    });
    
    // We can't start without being configured.
    if (!config) {
      return;
    }

    const {
      authToken,
      discoverFrequency = 60000,
    } = config;

    if (!authToken) {
      this.log.warn('No auth token configured. For configuration instructions, visit https://github.com/drudge/homebridge-mobilelink.');
      return;
    }

    this.mlapi = Got.extend({
      prefixUrl: MOBILE_LINK_API_URL,
      responseType: 'json',
      resolveBodyOnly: true,
      decompress: true,
      headers: {
        'User-Agent': `${MOBILE_LINK_API_USER_AGENT} (iPhone; iOS 14.0; Scale/3.00)`,
        'Connection': 'keep-alive',
        'Accept-Language': 'en-US;q=1',
        'AuthToken': authToken,
      },
    });

    this.log.debug('Finished initializing platform:', this.config.name || PLATFORM_NAME);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', async () => {
      this.log.debug('Discover Frequency: %i ms', discoverFrequency);

      // No devices reloaded? See if we can add some without waiting for the first discovery interval
      if (!this.accessories.length) {
        this.log.info('No accessories restored. Starting initial discovery.');
        await this.discoverDevices();
      }

      setInterval(async () => this.discoverDevices(), discoverFrequency);
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);

    // create the accessory handler for the restored accessory
    new MobileLinkAccessory(this, accessory);
  }

  /**
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {
    if (this.isDiscovering) {
      this.log.info('Discovery already in progress. Skipping.');
      return;
    }

    this.isDiscovering = true;

    const getGeneratorStatuses = this.mlapi('Generator/GeneratorStatus');
    const statuses: MobileLinkGeneratorStatus[] = await getGeneratorStatuses as unknown as MobileLinkGeneratorStatus[];

    // loop over the discovered generators and register each one if it has not already been registered
    for (const status of statuses) {
      const uuid = this.api.hap.uuid.generate(status.DeviceId);

      this.log.debug('UUID: %s - Generator Status: %j', uuid, status);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Updating existing accessory:', existingAccessory.displayName);

        existingAccessory.context.status = status;
        this.api.updatePlatformAccessories([existingAccessory]);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', status.GeneratorName);

        // create a new accessory
        const accessory = new this.api.platformAccessory(status.GeneratorName, uuid);

        // store a copy of the status object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.status = status;

        this.accessories.push(accessory);

        // create the accessory handler for the newly create accessory
        new MobileLinkAccessory(this, accessory);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }

      // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
      // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }

    this.isDiscovering = false;
  }
  
}
