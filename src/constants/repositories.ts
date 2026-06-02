export interface PublicRepository {
  label: string;
  href: string;
}

export const publicRepositoryLinks: PublicRepository[] = [
  {
    label: "TelloDB Platform",
    href: "https://github.com/tellodb/tellodb-platform",
  },
  {
    label: "TelloDB JS Client",
    href: "https://github.com/tellodb/tellodb-node",
  },
  {
    label: "TelloDB Python Client",
    href: "https://github.com/tellodb/tellodb-python",
  },
  {
    label: "Claude Code Memory",
    href: "https://github.com/tellodb/tellodb-agent-memory-adapters",
  },
  {
    label: "Gemini Memory",
    href: "https://github.com/tellodb/tellodb-agent-memory-adapters",
  },
  {
    label: "Grok Memory",
    href: "https://github.com/tellodb/tellodb-agent-memory-adapters",
  },
  {
    label: "OpenAI Memory",
    href: "https://github.com/tellodb/tellodb-agent-memory-adapters",
  },
];

export const privateRepositoryNote =
  "Core engine repository is private: TelloDB";
