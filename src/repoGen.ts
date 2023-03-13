import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import shell from "shelljs";
import { faker } from "@faker-js/faker";
import axios, { AxiosError } from "axios";
import { RepoInfo } from "./types";
import all from "./repoConfig.json";

require("shelljs/global");

const localReposDir: string = "localRepos";

/**
 * @description Checks if git is installed, silences shell output and creates
 * directory to store cloned repos.
 * Exits program if git not installed.
 * @returns { void }
 */
function doInit(): void {
  if (!shell.which("git")) {
    shell.echo("Repo Gen utility requires git to be installed");
    shell.exit(1);
  }

  shell.config.silent = true;

  if (!fs.existsSync("clonedRepos")) {
    fs.mkdirSync("clonedRepos");
  }
}

/**
 * @description Gets the GitHub token used for authentication from .env file.
 * Exits program if GitHub token not configured in .env file.
 * @returns { string } GitHub token
 */
function getGitHubToken(): string {
  dotenv.config({ path: ".env" });
  if (!process.env.REPO_GEN_GITHUB_TOKEN) {
    shell.echo("Missing environment variable REPO_GEN_GITHUB_TOKEN");
    shell.exit(1);
  }
  return process.env.REPO_GEN_GITHUB_TOKEN;
}

/**
 * @description Processes the repoConfig.json file and creates repos per counter value.
 * If configured name field is empty, then generate a fake repo name.
 * @returns { void }
 */
async function processRepoConfig(): Promise<void> {
  let repoCreationCounter: number = 0;
  const inProgress: Promise<void>[] = [];

  repoList.forEach((repo) => {
    if (repo.count !== 0) {
      const sourceRepoName: string = getSourceRepoName(repo.url);

      for (let i = 1; i <= repo.count; i++) {
        const targetRepoName = determineNewRepoName(repo.name, i, repo.count);
        const repoNew: RepoInfo = { ...repo, name: targetRepoName };
        inProgress.push(createTargetRepo(repoNew, sourceRepoName));
        repoCreationCounter++;
      }
    }
  });
  await Promise.all(inProgress);
  deleteLocalRepos();
  shell.echo(`TOTAL REPOSITORIES CREATED: ${repoCreationCounter}`);
}

/**
 * @description Creates a new target repo, clones the source repo and pushes source repo into new target repo.
 * @param { RepoInfo } repo repository info to be created
 * @param { string } sourceRepoName source repository name
 * @returns { void }
 */
async function createTargetRepo(
  repo: RepoInfo,
  sourceRepoName: string
): Promise<void> {
  shell.echo(
    `Processing ${repo.url} count: ${repo.count} ---> ${repo.organization}/${repo.name}`
  );

  const body = {
    name: repo.name,
    description: repo.description,
    private: repo.isPrivate,
  };
  try {
    await axios.post(
      `https://api.github.com/orgs/${repo.organization}/repos`,
      body,
      {
        headers: {
          Authorization: "token " + gitHubToken,
          Accept: "application/vnd.github+json",
        },
      }
    );

    copySourceRepoToTargetRepo(repo, sourceRepoName);
  } catch (err) {
    const errors = err as Error | AxiosError;
    if (axios.isAxiosError(errors)) {
      shell.echo(
        `ERROR ${repo.organization}/${repo.name} ${errors.response?.data.message} ${errors.response?.data.errors[0].message}`
      );
    }
  }
}

/**
 * @description Determine the name of the source repo from its URL
 * So if URL is https://gitlab.laputa.veracode.io/sca/srcclr/example-java-maven,
 * then return "example-java-maven"
 * @param { repoUrl } repoUrl repository URL
 * @returns { string } source repo name
 */
function getSourceRepoName(repoUrl: string): string {
  const url = new URL(repoUrl);
  const sourceRepoName = url.pathname.substring(
    url.pathname.lastIndexOf("/") + 1,
    url.pathname.length
  );
  return sourceRepoName;
}

/**
 * @description Generate a fake repository name using npm faker module
 * using format of "random word + random word + random last name"
 * @returns { string } fake repo name
 */
function generateRandomName(): string {
  return (
    faker.random.word() +
    "-" +
    faker.random.word() +
    "-" +
    faker.name.lastName()
  );
}

/**
 * @description Determine the new repository name. If name is not provided, then generate
 * a fake name.  If name is provided, then append hyphen and counter index.
 * @param { string } name repository name to be created
 * @param { number } index counter index to append to repo name
 * @param { number } count count for how many repos to create
 * @returns { string } new repository name
 */
function determineNewRepoName(
  name: string,
  index: number,
  count: number
): string {
  let newName: string = name;
  if (name === null || name === "") {
    newName = generateRandomName();
  } else {
    if (count > 1) {
      newName = `${name}-${index}`;
    }
  }
  return newName;
}

/**
 * @description Runs the shellJS git commands to copy source repo to new target repo.
 * @param { RepoInfo } repo repository info to be created
 * @param { string } sourceRepoName source repo name
 * @returns { void }
 */
function copySourceRepoToTargetRepo(
  repo: RepoInfo,
  sourceRepoName: string
): void {
  try {
    // if repo not already created, then git clone
    if (!fs.existsSync(path.resolve(localReposDir + "/" + sourceRepoName))) {
      if (
        shell.exec(`git clone ${repo.url}`, {
          cwd: path.resolve(localReposDir),
        }).code !== 0
      ) {
        shell.echo(`git clone failure`);
        shell.exit(1);
      }
    }

    if (
      shell.exec(`git remote remove origin`, {
        cwd: path.resolve(localReposDir + "/" + sourceRepoName),
      }).code !== 0
    ) {
      shell.echo(`git remote remove origin failed`);
      shell.exit(1);
    }

    if (
      shell.exec(
        `git remote add origin https://github.com/${repo.organization}/${repo.name}.git`,
        { cwd: path.resolve("clonedRepos/" + sourceRepoName) }
      ).code !== 0
    ) {
      shell.echo(`git remote add origin failed`);
      shell.exit(1);
    }

    if (
      shell.exec(`git branch -M main`, {
        cwd: path.resolve(localReposDir + "/" + sourceRepoName),
      }).code !== 0
    ) {
      shell.echo(`git branch failed`);
      shell.exit(1);
    }

    if (
      shell.exec(`git push -u origin main`, {
        cwd: path.resolve(localReposDir + "/" + sourceRepoName),
      }).code !== 0
    ) {
      shell.echo(`git push failed`);
      shell.exit(1);
    }
  } catch (error) {
    shell.exec(`command failed: ` + error);
  }
}

// Read in repo configuration file entries and store in array
const repoList = all as RepoInfo[];

// Checks if git is installed, silences shell output, creates directory to store
// cloned repos
doInit();

// Determine GitHubToken from .env file
const gitHubToken = getGitHubToken();

// Process and create repositories according to repoConfig.json file
processRepoConfig();

/**
 * @description TODO:
 */
function deleteLocalRepos() {
  // TODO: implement delete.
}
