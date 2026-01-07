/**
 * GitHub API Client - Business Logic Layer
 * Abstraction over GitHub API, can be moved to backend
 */
import { Octokit } from '@octokit/rest';
import { AppConfig } from '../config/AppConfig';

export interface GitHubUploadParams {
  filePath: string;
  content: string; // base64 encoded
  message: string;
  branch: string;
}

export interface GitHubUploadResult {
  sha: string;
  url: string;
  htmlUrl: string;
}

/**
 * GitHub API Client
 * In backend, this would use server-side token
 * In frontend, token is injected at build time
 */
export class GitHubApiClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(private config: AppConfig) {
    if (!config.github.token) {
      throw new Error('GitHub token not configured');
    }

    this.octokit = new Octokit({
      auth: config.github.token,
    });

    this.owner = config.github.owner;
    this.repo = config.github.repository;
  }

  /**
   * Upload file to GitHub repository
   * This method can be moved to backend without changes
   */
  async uploadFile(params: GitHubUploadParams): Promise<GitHubUploadResult> {
    try {
      const response = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: params.filePath,
        message: params.message,
        content: params.content,
        branch: params.branch,
      });

      return {
        sha: response.data.content?.sha || '',
        url: response.data.content?.download_url || '',
        htmlUrl: response.data.content?.html_url || '',
      };
    } catch (error: any) {
      throw new Error(`GitHub API error: ${error.message}`);
    }
  }

  /**
   * Check if file exists in repository
   */
  async fileExists(filePath: string, branch: string): Promise<boolean> {
    try {
      await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: filePath,
        ref: branch,
      });
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Health check - verify token and repository access
   */
  async healthCheck(): Promise<{ hasAccess: boolean; message: string }> {
    try {
      await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo,
      });
      return {
        hasAccess: true,
        message: 'GitHub API access verified',
      };
    } catch (error: any) {
      return {
        hasAccess: false,
        message: `GitHub API error: ${error.message}`,
      };
    }
  }
}
