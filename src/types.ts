
export interface MobileLinkGeneratorStatus {
    GensetID: number;
    GeneratorDate: string;
    GeneratorName: string;
    GeneratorSerialNumber: string;
    GeneratorModel: string;
    GeneratorDescription: string;
    GeneratorMDN: string;
    GeneratorImei: string;
    GeneratorIccid: string;
    GeneratorTetherSerial: string;
    Connected: boolean;
    GreenLightLit: boolean;
    YellowLightLit: boolean;
    RedLightLit: boolean;
    BlueLightLit: boolean;
    GeneratorStatus: string;
    GeneratorStatusDate: string;
    CurrentAlarmDescription: string;
    RunHours: number;
    ExerciseHours: number;
    BatteryVoltage: string;
    FuelType: number;
    FuelLevel: number;
    GeneratorBrandImageURL: string;
    GeneratorServiceStatus: boolean;
    Accessories: Record<string, unknown>[],
    SignalStrength: string;
    DeviceId: string;
    DeviceTypeId: number;
    FirmwareVersion: string;
    Timezone: string;
    MACAddress: string;
    IPAddress: string;
    SSID: string;
  }
export interface MobileLinkApparatusProperty {
    name: string;
    value: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    type: number;
  }
  
export interface MobileLinkApparatus {
    apparatusId: number;
    serialNumber: string;
    name: string;
    type: number;
    localizedAddress: string | null;
    materialDescription: string | null;
    heroImageUrl: string | null;
    apparatusStatus: number;
    isConnected: boolean;
    isConnecting: boolean;
    showWarning: boolean;
    weather: {
      temperature: {
        value: number,
        unit: string,
        unitType: number
      },
      iconCode: number
    } | null;
    preferredDealerName: string | null;
    preferredDealerPhone: string | null;
    preferredDealerEmail: string | null;
    isDealerManaged: boolean;
    isDealerUnmonitored: boolean;
    modelNumber: string;
    panelId: string;
    properties: MobileLinkApparatusProperty[] | null;
    values: null;
    provisioned: string | null; 
  }