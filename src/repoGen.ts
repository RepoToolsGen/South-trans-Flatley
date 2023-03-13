import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import shell from "shelljs";
import { faker } from "@faker-js/faker";
import axios, { AxiosError } from "axios";
import { RepoInfo } from "./types";
import all from "./repoConfig.json";

require("shelljs/global");

/**
 * @description Checks if git is installed and reads in GitHub token used for authentication.
 * Exits program is git not installed.
 * Exits program if GitHub token not configured in .env file.
 * @returns { string } GitHub token
 */
function doInit(): string {
  if (!shell.which("git")) {
    shell.echo("Repo Gen utility requires git to be installed");
    shell.exit(1);
  }

  dotenv.config({ path: ".env" });
  if (!process.env.REPO_GEN_GITHUB_TOKEN) {
    shell.echo("Missing environment variable REPO_GEN_GITHUB_TOKEN");
    shell.exit(1);
  }
  return process.env.REPO_GEN_GITHUB_TOKEN;
}

/**
 * @description Processes the configure repo list and creates repos per counter value.
 * If configured name field is empty, then generate a fake repo name.
 * @returns { void }
 */
function generateRepos(): void {
  let repoCreationCounter: number = 0;
  repoList.forEach((repo) => {
    shell.echo(
      `Processing ${repo.url} ---> ${repo.organization}/${repo.name} count: ${repo.count}`
    );
    // Create repositories per count.  If count is zero, then skip
    if (repo.count !== 0) {
      if (repo.name === null || repo.name === "") {
        repo.name = genRandomName();
      }
      // if count exceeds 1, then append a dash and index counter for uniqueness
      const origName = repo.name;
      for (let i = 1; i <= repo.count; i++) {
        if (repo.count > 1 && i >= 1) {
          repo.name = `${origName}-${i}`;
        }
        const repoNew: RepoInfo = Object.assign({}, repo);
        createRepo(repoNew);
        repoCreationCounter++;
      }
    }
  });
  shell.echo(`TOTAL REPOSITORIES CREATED: ${repoCreationCounter}`);
}

/**
 * @description Generates the HMAC header and sends the API REST message to SCA Agent.
 * @param { repoInfo } repo repository info to be created
 * @returns { void }
 */
function createRepo(repo: RepoInfo): void {
  const repoGenDir: string = "clonedRepos";

  const repoNameDir: string = getClonedRepoName(repo.url);

  const sendGetRequest = async () => {
    const body = {
      name: repo.name,
      description: repo.description,
      private: repo.isPrivate,
    };
    shell.echo(
      `Send POST create repo ${repo.organization}/${body.name} private: ${body.private}`
    );
    try {
      const response = await axios.post(
        `https://api.github.com/orgs/${repo.organization}/repos`,
        body,
        {
          headers: {
            Authorization: "token " + gitHubToken,
            Accept: "application/vnd.github+json",
          },
        }
      );

      if (!fs.existsSync("clonedRepos")) {
        fs.mkdirSync("clonedRepos");
      }
      // if repo not already created, then git clone
      if (!fs.existsSync(path.resolve(repoGenDir + "/" + repoNameDir))) {
        shell.echo(`do git clone ${repo.url}`);
        if (
          shell.exec(`git clone ${repo.url}`, { cwd: path.resolve(repoGenDir) })
            .code !== 0
        ) {
          shell.echo(`git clone failure`);
          shell.exit(1);
        }
      }

      if (
        shell.exec(`git remote remove origin`, {
          cwd: path.resolve(repoGenDir + "/" + repoNameDir),
        }).code !== 0
      ) {
        shell.echo(`git remote remove origin failed`);
        shell.exit(1);
      }

      if (
        shell.exec(
          `git remote add origin https://github.com/${repo.organization}/${repo.name}.git`,
          { cwd: path.resolve("clonedRepos/" + repoNameDir) }
        ).code !== 0
      ) {
        shell.echo(`git remote add origin failed`);
        shell.exit(1);
      }

      if (
        shell.exec(`git branch -M main`, {
          cwd: path.resolve(repoGenDir + "/" + repoNameDir),
        }).code !== 0
      ) {
        shell.echo(`git branch failed`);
        shell.exit(1);
      }

      if (
        shell.exec(`git push -u origin main`, {
          cwd: path.resolve(repoGenDir + "/" + repoNameDir),
        }).code !== 0
      ) {
        shell.echo(`git push failed`);
        shell.exit(1);
      }
    } catch (err) {
      const errors = err as Error | AxiosError;
      if (axios.isAxiosError(errors)) {
        console.log("failed to create repository in: " + repo.organization);
        console.log(errors.response?.data.message);
        console.log(errors.response?.data.errors[0]);
      }
    }
  };
  sendGetRequest();
}

/**
 * @description Determine the name of the cloned repo from its URL
 * So if URL is https://gitlab.laputa.veracode.io/sca/srcclr/example-java-maven,
 * then return "example-java-maven"
 * @param { repoUrl } repoUrl repository URL
 * @returns { string } cloned repo name
 */
function getClonedRepoName(repoUrl: string): string {
  const url = new URL(repoUrl);
  const clonedRepoName = url.pathname.substring(
    url.pathname.lastIndexOf("/") + 1,
    url.pathname.length
  );
  return clonedRepoName;
}

/**
 * @description Generate a fake respository name using npm faker module
 * using format of "random word + random word + random last name"
 * @returns { string } cloned repo name
 */
function genRandomName(): string {
  return (
    faker.random.word() +
    "-" +
    faker.random.word() +
    "-" +
    faker.name.lastName()
  );
}

// Read in repo configuration file entries and store in array
const repoList = all as RepoInfo[];

// Determine GitHubToken from .env file
const gitHubToken = doInit();

// Generate repositories according to repoConfig.json file
generateRepos();
