import {
  Waves, Bath, Mountain, Building2, Clapperboard, MonitorPlay, Tv, Gamepad2, Music,
  Utensils, Coffee, Flame, Snowflake, Thermometer, Wifi, Laptop, VolumeX, WashingMachine,
  Sun, Trees, Sofa, Car, Zap, ShieldCheck, Cctv, ArrowUpDown, KeyRound, PawPrint, Baby, Dumbbell, Check,
} from "lucide-react";

type Icon = typeof Check;

// Map an amenity name to an icon (keyword based, first match wins). Mirrors the
// CRM's canonical amenity catalog (Esker OS lib/amenities.ts). Falls back to a check.
const RULES: [RegExp, Icon][] = [
  [/pool|swimming/i, Waves],
  [/jacuzzi|hot ?tub|\bbath/i, Bath],
  [/margalla|mountain|valley/i, Mountain],
  [/city|skyline/i, Building2],
  [/cinema|movie|theatre|theater/i, Clapperboard],
  [/projector/i, MonitorPlay],
  [/smart ?tv|\bled\b|television|\btv\b|screen/i, Tv],
  [/xbox|ps4|ps5|playstation|gaming|console/i, Gamepad2],
  [/sound ?system|speaker|music/i, Music],
  [/kitchen|dining|cook/i, Utensils],
  [/coffee|nespresso/i, Coffee],
  [/bbq|grill|barbecue/i, Flame],
  [/air ?condition|\bac\b|cooling/i, Snowflake],
  [/heating|heater|heated/i, Thermometer],
  [/wifi|wi-fi|internet/i, Wifi],
  [/workspace|desk|work area/i, Laptop],
  [/soundproof/i, VolumeX],
  [/washer|washing|laundry/i, WashingMachine],
  [/terrace|balcony/i, Sun],
  [/garden|lawn|backyard/i, Trees],
  [/outdoor seating|patio|sitting/i, Sofa],
  [/parking|garage|\bcar\b/i, Car],
  [/backup|generator|\bups\b|power/i, Zap],
  [/security|guard|gated/i, ShieldCheck],
  [/cctv|camera|surveillance/i, Cctv],
  [/elevator|lift/i, ArrowUpDown],
  [/self ?check|keypad|smart lock|check-?in/i, KeyRound],
  [/\bpet/i, PawPrint],
  [/family|\bkid|child/i, Baby],
  [/gym|fitness|exercise/i, Dumbbell],
  [/view/i, Mountain],
  [/outdoor|rooftop|prayer/i, Trees],
];

function iconFor(a: string): Icon {
  for (const [re, ic] of RULES) if (re.test(a)) return ic;
  return Check;
}

export function AmenityList({ amenities }: { amenities: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {amenities.map((a) => {
        const Ic = iconFor(a);
        return (
          <span key={a} className="inline-flex items-center gap-2.5 text-sm text-ink">
            <Ic size={17} className="shrink-0 text-gold" strokeWidth={1.75} /> {a}
          </span>
        );
      })}
    </div>
  );
}
