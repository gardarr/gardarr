import * as Flags from "country-flag-icons/react/3x2";

type FlagComponent = (props: React.SVGAttributes<SVGSVGElement>) => React.JSX.Element;

// qBittorrent's country_code is ISO 3166-1 alpha-2, matching country-flag-icons'
// export names one-to-one - falls back to nothing for unresolved/local peers.
export function CountryFlag({ countryCode, className }: { countryCode?: string; className?: string }) {
  if (!countryCode) return null;

  const code = countryCode.toUpperCase();
  const Flag = (Flags as unknown as Record<string, FlagComponent>)[code];
  if (!Flag) return null;

  return <Flag className={className} />;
}
