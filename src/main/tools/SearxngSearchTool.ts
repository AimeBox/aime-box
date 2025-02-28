import { SearxngSearch } from '@langchain/community/tools/searxng_search';

export class SearxngSearchTool extends SearxngSearch {
  async _call(input) {
    const queryParams = {
      q: input,
      ...this.params,
    };
    const url = this.buildUrl('search', queryParams, this.apiBase);
    const maxTryTime = 3;

    for (let index = 0; index < maxTryTime; index++) {
      const res = await this.search(url);
      if (res != 'No good results found.') {
        return res;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
    }
    throw new Error('No good results found.');
  }

  async search(url: string) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      signal: AbortSignal.timeout(10 * 1000), // 5 seconds
    });
    if (!resp.ok) {
      throw new Error(resp.statusText);
    }
    const res = await resp.json();
    if (
      !res.results.length &&
      !res.answers.length &&
      !res.infoboxes.length &&
      !res.suggestions.length
    ) {
      return 'No good results found.';
    } else if (res.results.length) {
      const response = [];
      res.results.forEach((r) => {
        response.push(
          JSON.stringify({
            title: r.title || '',
            link: r.url || '',
            snippet: r.content || '',
          }),
        );
      });
      return `[${response.slice(0, this.params?.numResults).join(', ')}]`;
    } else if (res.answers.length) {
      return res.answers[0];
    } else if (res.infoboxes.length) {
      return res.infoboxes[0]?.content.replaceAll(/<[^>]+>/gi, '');
    } else if (res.suggestions.length) {
      let suggestions = 'Suggestions: ';
      res.suggestions.forEach((s) => {
        suggestions += `${s}, `;
      });
      return `[${suggestions}]`;
    } else {
      return 'No good results found.';
    }
  }
}
