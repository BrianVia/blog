export interface NavLink {
  href: string;
  label: string;
}

export const primaryNav: NavLink[] = [
  { href: "/", label: "Journal" },
  { href: "/about", label: "About" },
  { href: "/social", label: "Social" },
  { href: "/feeds", label: "Feeds" },
  { href: "/links", label: "Links" },
  { href: "/books", label: "Library" },
  { href: "/uses", label: "Uses" },
];
