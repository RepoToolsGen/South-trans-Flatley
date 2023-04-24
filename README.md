# repo-gen

## Overview

Repo Gen is an Node application that generates GitHub repositories for the purpose
of load testing or demos.

The source repositories are locally cloned, renamed, and copied to a user's GitHub
account within an organization. A user's GitHub personal access token is required.
A repoConfig.json file is populated with a repository list to be used as input for
the application. The json file details the source repository, the target repository
organization and name, private/public repo indicator, description, and a count
of how many repos to create for each source repository.

The following are the commands used by the application. A shellJS exec command
is used to execute the git commands.

    1. POST https://api.github.com/orgs/${repo.organization}/repos
        - header authentication with GitHub token
        - body contains new repo info
    2. git clone url
    3. git remote remove origin
    4. git remote add origin git@github.com/${repo.organization}/${repo.name}.git
    5. git branch -M main
    6. git push -u origin main

To compliment bulk repository creation, there is a utility to perform remote repository
deletion, Repo Delete (https://gitlab.laputa.veracode.io/repo-tools/repo-delete).
The input to Repo Delete is a json file containing entries of repositories to delete in
GitHub. Hence, Repo Gen creates a delete repos json file listing the repos just created.
The date and time is included in the json file to preserve the history. This file can be
used as input to Repo Delete Utility. The file is named deleteRepos-YYYYMMDD-HHMM.json.

Repo Gen --> creates deleteRepos-YYYYMMDD-HHMM.json
Repo Delete --> processes deleteRepos.json

## Configuration

To run Repo Gen, the Git software needs to be installed.

Create an SSH Key. Log into to your GitHub account and go to
Settings -> SSH and GPG keys, then configure a new SSH key.

Create `.env` file in repo-gen top-level directory which contains a user GitHub
personal access token named REPO_GEN_GITHUB_TOKEN. Refer to sample below.

    # User GitHub token
    REPO_GEN_GITHUB_TOKEN=ghp_RvhIefInvalidInvalidRCMNhw4LHjQT

Copy repoConfig-template.json to repoConfig.json in the same directory.
Edit repoConfig.json and configure the repositories you want to create.
The following json entry represents a single repository:

    {
      "url": "https://gitlab.laputa.veracode.io/sca/srcclr/example-java-maven",
      "organization": "RepoToolsGen",
      "name": "example-java-maven",
      "description": "java maven",
      "isPrivate": true,
      "count": 3
    }

The json fields are detailed below:

    * url - source repository url
    * organization - target GitHub organization
    * name - target repository name
        If the name is empty, generate a fake randomly generated repo name
        with format:  "word-word-last name"
    * description - target repository description
    * isPrivate - target private/public boolean indicator
    * count - number of target repositories to create
        If the count is 0, then do not create a repository.

        If the count is > 1 and name is specified, then append "-" and
        count index to the name. For example, for the following values ...
            "url": "https://gitlab.laputa.veracode.io/sca/srcclr/example-java-maven",
            "organization": "RepoToolsGen",
            "name": "example-java-maven",
            "count": 3
        the GitHub repositories created are:
            https: github.com/RepoToolsGen/example-java-maven-1
            https: github.com/RepoToolsGen/example-java-maven-2
            https: github.com/RepoToolsGen/example-java-maven-3

## GitHub Rate Limits

The GitHub API rate limit ensures that the API is fast and available for everyone.
If the GitHub API rate limit is exceeded, GitHub will send an HTTP 403 response.
The response header contains the following x-ratelimit fields which are shown in the
console output.

    x-ratelimit-limit     The maximum number of requests you're permitted to make per hour.
    x-ratelimit-remaining The number of requests remaining in the current rate limit window.
    x-ratelimit-used      The number of requests you've made in the current rate limit window.
    x-ratelimit-reset     The UTC epoch time in secs at which the current rate limit window resets.

If you are limited, you should not run Repo Gen until after the reset time per the
x-ratelimit-reset value. User access token requests are limited to 5,000 requests per hour
and per authenticated user. GitHub also uses secondary rate limits to ensure API availability.
For POST repo create requests, GitHub specifies to wait at least one second between each
request.

Repo Gen waits 4 seconds between each POST request. When creating a large amount
of repos, you may encounter secondary rate limits even though the request interval
and repo count criteria are met. If this occurs, then you will be limited for about
30 minutes to 1 hour.

You can refer to the GitHub cocumentation:
https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting

https://docs.github.com/en/rest/guides/best-practices-for-integrators?apiVersion=2022-11-28#dealing-with-rate-limits

https://docs.github.com/en/rest/guides/best-practices-for-integrators?apiVersion=2022-11-28#dealing-with-secondary-rate-limits

## To Build and Run Application Locally

1. npm ci
2. npm run build
3. npm run start
