# repo-gen

## Overview

Repo Gen is an Node application that generates GitHub repositories for the purpose
of load testing or demos.

An existing repository is cloned, renamed, and pushed to a user's GitHub account
organization. A GitHub access token with associated GitHub organization is required.
A json configuration file is populated with examples, which can be enabled/disabled
for repository creation. The config file details the originating repository to be
cloned, the new repo organization and name, the private/public repo indicator,
repo description, and a count of how many repos to create.

The following are the commands used by the application. A shellJS exec command
is used to execute the git commands.

    1. POST https://api.github.com/orgs/${repo.organization}/repos
        - header authentication with GitHub token
        - body contains new repo info
    2. git clone url
    3. git remote remove origin
    4. git remote add origin https://github.com/${repo.organization}/${repo.name}.git
    5. git branch -M main
    6. git push -u origin main

## Configuration

To run Repo Gen, the git software needs to be installed.

Create `.env` file in repo-gen top-level directory which contains a user GitHub
personal access token named REPO_GEN_GITHUB_TOKEN. Refer to sample below.

    # User GitHub token
    REPO_GEN_GITHUB_TOKEN=ghp_RvhIefInvalidInvalidRCMNhw4LHjQT

To configure the repositories to be generated, copy repoConfig-template.json to
repoConfig.json in the same directory. Edit repoConfig.json to configure the
repositories to be created. The following is a json entry representing info
for a single repository:

    {
     "url": "https://gitlab.laputa.veracode.io/sca/srcclr/example-java-maven",
     "organization": "RepoToolsGen",
     "name": "example-java-maven",
     "description": "javen maven",
     "isPrivate": true,
     "count": 3
    }

The repoConfig.json fields are detailed below:

    1. url - URL of the repository to be cloned
    2. organization - existing GitHub organization
    3. name - repository name to be created - if the name is empty then generate
        a fake name with format: "random word + random word + random last name"
    4. description - description of repository
    5. isPrivate - private or public repo boolean indicator
    6. count - count of repositories to be created for the origin repo

        If the count is 0, then do not create a repository for this entry.

        If the count is > 1 and name is specified, then append "-" and
        count index to the name. For example, for the following values
            "url": "https://gitlab.laputa.veracode.io/sca/srcclr/example-java-maven",
            "organization": "RepoToolsGen",
            "name": "example-java-maven",
            "count": 3
        the GitHub repositories created are:
            https: github.com/RepoToolsGen/example-java-maven-1
            https: github.com/RepoToolsGen/example-java-maven-2
            https: github.com/RepoToolsGen/example-java-maven-3

        If the count is 1, then do not append the hyphen and index.
        For example, for the following values
            "url": "https://gitlab.laputa.veracode.io/sca/srcclr/example-java-maven",
            "organization": "RepoToolsGen",
            "name": "example-java-maven",
            "count": 1
        the GitHub repositories created are:
            https //github.com/RepoToolsGen/example-java-maven

## To Build and Run Service Locally

1. npm ci
2. npm run build
3. npm run start
