/**
 * This is the name of the platform that users will use to register the plugin in the Homebridge config.json
 */
export const PLATFORM_NAME = 'MobileLink';

/**
 * This must match the name of your plugin as defined the package.json
 */
export const PLUGIN_NAME = 'homebridge-mobilelink';

/**
 * This is the name of the manufacturer.
 */
export const DEFAULT_MANUFACTURER_NAME = 'Generac®';

/**
 * This is the API endpoint for the Mobile Link platform.
 */
export const MOBILE_LINK_API_URL = process.env.MOBILE_LINK_API_URL || 'https://api.mobilelinkgen.com';

/**
 * This is the User Agent to send when calling the endpoint for the Mobile Link platform.
 */
export const MOBILE_LINK_API_USER_AGENT = process.env.MOBILE_LINK_API_USER_AGENT || 'StandbyStatusProd/1.4.9.3148';