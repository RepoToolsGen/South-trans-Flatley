import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import shell from "shelljs";
import { faker } from "@faker-js/faker";
import axios from "axios";
import { CreateRepoInfo, DeleteRepoInfo } from "./types";

const localReposDir: string = "localRepos";
const waitTimeInMs: number = 4000;
const startDate: number = Date.now();
let deleteRepoList: DeleteRepoInfo[] = [];
let failures = 0;
let successes = 0;

// Read in repo configuration file entries and store in array
const text = fs.readFileSync("./repoConfig.json", "utf8");
const repoList = JSON.parse(text) as CreateRepoInfo[];

/**
 * @description Checks if git is installed, silences shell output and creates
 * directory to store cloned repos.
 * Exits program if git not installed.
 * @returns { void }
 */
function doValidationAndSetup(): void {
  if (!shell.which("git")) {
    console.log("Repo Gen utility requires git to be installed");
    process.exit(1);
  }

  shell.config.silent = true;

  if (!fs.existsSync(localReposDir)) {
    fs.mkdirSync(localReposDir);
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
    console.log("Missing environment variable REPO_GEN_GITHUB_TOKEN");
    process.exit(1);
  }
  return process.env.REPO_GEN_GITHUB_TOKEN;
}

/**
 * @description Processes the repoConfig.json file and creates repos per counter value.
 * If configured name field is empty, then generate a fake repo name.
 * Generate delete repos file containing entries for newly created repos.
 * @returns { Promise<void> }
 */
async function processRepoConfig(): Promise<void> {
  let repoCreationCounter: number = 0;
  const inProgress: Promise<void>[] = [];

  for (let j = 0; j < repoList.length; j++) {
    const repo: CreateRepoInfo = repoList[j];
    if (repo.count !== 0) {
      console.log(
        `Processing source repository ${repo.url} ${repo.count} time(s)`
      );
      const sourceRepoName: string = getSourceRepoName(repo.url);

      for (let i = 1; i <= repo.count; i++) {
        // Throttle API requests to prevent GitHub API secondary rate limits
        await wait(waitTimeInMs);
        const targetRepoName = determineNewRepoName(repo.name, i, repo.count);
        const repoNew: CreateRepoInfo = { ...repo, name: targetRepoName };
        console.log(
          `    Creating target repository ${targetRepoName} in GitHub organization ${repo.organization}`
        );
        inProgress.push(createTargetRepo(repoNew, sourceRepoName));
        repoCreationCounter++;
      }
    }
  }

  console.log("Processing, please wait...\n");
  await Promise.all(inProgress);

  deleteLocalRepos();
  generateDeleteReposFile();

  console.log(
    "Repo Gen duration in minutes: " +
      ((Date.now() - startDate) / (1000 * 60)).toFixed(1)
  );
  console.log(
    `Total repositories processed: ${repoCreationCounter}, ${successes} successful, ${failures} failures`
  );
}

/**
 * @description Waits for the specified duration
 * @param { number } durationInMs amount of time to wait in milliseconds
 * @returns { Promise<void> }
 */
async function wait(durationInMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationInMs));
}

/**
 * @description Creates a new target repo, clones the source repo and pushes source repo into new target repo.
 * @param { RepoInfo } repo repository info to be created
 * @param { string } sourceRepoName source repository name
 * @returns { Promise<void> }
 */
async function createTargetRepo(
  repo: CreateRepoInfo,
  sourceRepoName: string
): Promise<void> {
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

    addRepoToDeleteList(repo.organization, repo.name);

    successes++;
  } catch (err: any) {
    failures++;
    console.log(`Error processing ${repo.organization}/${repo.name}`);
    console.log(`    ${err.message}`);
    if (err.response?.data?.message) {
      console.log(`    ${err.response.data.message}`);
    }
    if (err.response.status === 403) {
      console.log(
        `    x-ratelimit-limit: ${err.response.headers.get(
          "x-ratelimit-limit"
        )}   Maximum number of requests you're permitted to make per hour`
      );
      console.log(
        `    x-ratelimit-remaining: ${err.response.headers.get(
          "x-ratelimit-remaining"
        )}   Number of requests remaining in current rate limit window`
      );
      console.log(
        `    x-ratelimit-used: ${err.response.headers.get(
          "x-ratelimit-used"
        )}   Number of requests you've made in current rate limit window`
      );

      const utcEpochSecs = err.response.headers.get("x-ratelimit-reset");
      console.log(
        `    x-ratelimit-reset: ${utcEpochSecs}   Time at which the current rate limit resets in UTC epoch seconds\n`
      );

      const resetDate = new Date(0);
      resetDate.setUTCSeconds(utcEpochSecs);
      console.log(`    local reset time: ${resetDate.toString()}\n`);

      console.log(`*** Aborting: A fatal error occurred.`);
      deleteLocalRepos();
      process.exit(2);
    }
    if (axios.isAxiosError(err) && err.response?.data?.errors?.length > 0) {
      console.log(`    ${err.response?.data?.errors[0].message}`);
    }
    console.log("Processing, please wait...\n");
  }
}

/**
 * @description Determine the name of the source repo from its URL. For example,
 * if URL is https://gitlab.laputa.veracode.io/sca/srcclr/example-java-maven,
 * then return "example-java-maven".
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
 * using format of "random word - random word - random last name"
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
 * a fake name. If name is provided, then append hyphen and counter index.
 * @param { string } name target repository name
 * @param { number } index counter index
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
    // Remove/replace invalid characters that faker may generate, since not allowed
    newName = newName.replace(/['//]/g, "-");
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
  repo: CreateRepoInfo,
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
        throw new Error(
          `git clone failure for ${repo.organization}/${repo.name}`
        );
      }
    }

    if (
      shell.exec(`git remote remove origin`, {
        cwd: path.resolve(localReposDir + "/" + sourceRepoName),
      }).code !== 0
    ) {
      throw new Error(
        `git remote remove origin failed for ${repo.organization}/${repo.name}`
      );
    }

    if (
      shell.exec(
        `git remote add origin git@github.com:${repo.organization}/${repo.name}.git`,
        { cwd: path.resolve(`${localReposDir}/${sourceRepoName}`) }
      ).code !== 0
    ) {
      throw new Error(
        `git remote add origin failed for ${repo.organization}/${repo.name}`
      );
    }

    if (
      shell.exec(`git branch -M main`, {
        cwd: path.resolve(localReposDir + "/" + sourceRepoName),
      }).code !== 0
    ) {
      throw new Error(
        `git branch failed for ${repo.organization}/${repo.name}`
      );
    }

    if (
      shell.exec(`git push -u origin main`, {
        cwd: path.resolve(localReposDir + "/" + sourceRepoName),
      }).code !== 0
    ) {
      throw new Error(`git push failed for ${repo.organization}/${repo.name}`);
    }
  } catch (err: any) {
    console.log(
      `*** Aborting: A fatal error occurred. Please verify you have Git set up appropriately and have GitHub set up to use an SSH key.`
    );
    console.log(`ERROR: ${err.message}`);
    // Comment deleteLocalRepos() out, if you need to debug any of the above git commands
    deleteLocalRepos();
    process.exit(2);
  }
}

/**
 * @description Adds newly created repository to delete repo array.
 * @param { string } organization GitHub organization
 * @param { string } name repo name
 * @returns { void }
 */
function addRepoToDeleteList(organization: string, name: string): void {
  const deleteRepo: DeleteRepoInfo = {
    organization,
    name,
  };
  deleteRepoList.push(deleteRepo);
}

/**
 * @description Deletes local repositories.
 * @returns { void }
 */
function deleteLocalRepos(): void {
  try {
    fs.rmSync(path.resolve(localReposDir), { recursive: true, force: true });
  } catch (error) {
    console.log(`Delete directory failure for ${localReposDir}`);
  }
}

/**
 * @description Generates delete repos json file for newly created repos.
 * @returns { void }
 */
function generateDeleteReposFile(): void {
  if (deleteRepoList.length > 0) {
    const deleteRepoListJson: string = JSON.stringify(deleteRepoList, null, 2);
    let now = new Date();
    const dateTime = `${now.getFullYear()}${
      now.getMonth() + 1
    }${now.getDate()}-${now.getHours()}${now.getMinutes()}`;

    try {
      fs.writeFileSync(`./deleteRepos-${dateTime}.json`, deleteRepoListJson);
      console.log(`deleteRepos-${dateTime}.json created\n`);
    } catch (err: any) {
      console.log(`Failed to create delete repos json file: ${err.message}`);
    }
  }
}

// Checks if Git is installed, silence shell output, and create directory to store
// local repos
doValidationAndSetup();

// Determine user GitHub access token from .env file
const gitHubToken = getGitHubToken();

// Process and create repositories according to repoConfig.json file
processRepoConfig();
