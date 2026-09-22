export interface NavLink {
  href: string;
  label: string;
}

export const primaryNav: NavLink[] = [
  { href: "/", label: "Side Effects" },
  { href: "/about/", label: "About" },
  { href: "/social/", label: "Social" },
  { href: "/feeds/", label: "Feeds" },
  { href: "/books/", label: "Library" },
  { href: "/uses/", label: "Uses" },
];
