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

## Configuration

To run Repo Gen, the git software needs to be installed.

Login to your GitHub account and go to settings -> SSH and GPG keys -> configure SSH key.

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

    1. url - source repository url
    2. organization - target GitHub organization
    3. name - target repository name
        If the name is empty, generate a fake name of format:
        "random word + random word + random last name"
    4. description - target repository description
    5. isPrivate - target private/public boolean indicator
    6. count - number of target repositories to create

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

## To Build and Run Service Locally

1. npm ci
2. npm run build
3. npm run start
