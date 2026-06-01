export interface PublicRepository {
  label: string;
  href: string;
}

export const publicRepositoryLinks: PublicRepository[] = [
  {
    label: "Tellodb Platform",
    href: "https://github.com/SharjeelAbbas014/tellodb-platform",
  },
  {
    label: "Tellodb JS Client",
    href: "https://github.com/SharjeelAbbas014/tellodb-js-client",
  },
  {
    label: "Tellodb Python Client",
    href: "https://github.com/SharjeelAbbas014/tellodb-python-client",
  },
  {
    label: "Claude Code Memory",
    href: "https://github.com/SharjeelAbbas014/tellodb-claude-code-memory",
  },
  {
    label: "Gemini Memory",
    href: "https://github.com/SharjeelAbbas014/tellodb-gemini-memory",
  },
  {
    label: "Grok Memory",
    href: "https://github.com/SharjeelAbbas014/tellodb-grok-memory",
  },
  {
    label: "OpenAI Memory",
    href: "https://github.com/SharjeelAbbas014/tellodb-openai-memory",
  },
];

export const privateRepositoryNote =
  "Core engine repository is private: Tellodb";
