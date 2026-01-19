import { defineMiddleware } from 'astro:middleware';
import { getCollection } from 'astro:content';

export const onRequest = defineMiddleware(async ({ request, url }, next) => {
  // Only handle /posts/[slug] routes
  const postMatch = url.pathname.match(/^\/posts\/([^/]+)$/);

  if (postMatch) {
    const acceptHeader = request.headers.get('Accept') || '';

    // Check if client specifically wants markdown
    if (acceptHeader.includes('text/markdown')) {
      const slug = postMatch[1];

      try {
        const allPosts = await getCollection('posts');
        const post = allPosts.find((p) => p.data.slug === slug);

        if (post && post.body) {
          // Return raw markdown content
          return new Response(post.body, {
            status: 200,
            headers: {
              'Content-Type': 'text/markdown; charset=utf-8',
              'Content-Disposition': `inline; filename="${slug}.md"`,
            },
          });
        }
      } catch (error) {
        console.error('Error fetching post for markdown:', error);
      }
    }
  }

  // Continue to normal page rendering for HTML
  return next();
});
