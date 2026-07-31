const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

interface CookieOptions {
  maxAgeSeconds?: number;
}

export function getCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function setCookie(
  name: string,
  value: string,
  { maxAgeSeconds = ONE_YEAR_SECONDS }: CookieOptions = {}
): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax${secure}`;
}

export function removeCookie(name: string): void {
  document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax`;
}
