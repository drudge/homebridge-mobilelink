
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