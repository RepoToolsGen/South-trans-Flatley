export type CreateRepoInfo = {
  url: string;
  organization: string;
  name: string;
  description: string;
  isPrivate: boolean;
  count: number;
};

export type DeleteRepoInfo = {
  organization: string;
  name: string;
};
