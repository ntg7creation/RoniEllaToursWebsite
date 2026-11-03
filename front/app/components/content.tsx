import { Link } from "react-router";
import {
  tourPath,
  type ContentBlock,
  type PublicContent,
  type Tour,
  type Post,
} from "@roniella/shared";
export function Media({ id, content }: { id: string; content: PublicContent }) {
  const asset = content.mediaAssets.find((m) => m.id === id);
  if (!asset) return null;
  return (
    <figure>
      <img
        src={asset.publicPath}
        width={asset.width}
        height={asset.height}
        alt={asset.alt}
      />
      {(asset.caption || asset.credit) && (
        <figcaption>
          {asset.caption}
          {asset.credit && ` · ${asset.credit}`}
        </figcaption>
      )}
    </figure>
  );
}
export function Blocks({
  blocks,
  content,
}: {
  blocks: ContentBlock[];
  content: PublicContent;
}) {
  return (
    <div className="prose">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "paragraph":
            return <p key={i}>{b.text}</p>;
          case "heading":
            return b.level === 2 ? (
              <h2 key={i}>{b.text}</h2>
            ) : (
              <h3 key={i}>{b.text}</h3>
            );
          case "list":
            return b.ordered ? (
              <ol key={i}>
                {b.items.map((t, j) => (
                  <li key={j}>{t}</li>
                ))}
              </ol>
            ) : (
              <ul key={i}>
                {b.items.map((t, j) => (
                  <li key={j}>{t}</li>
                ))}
              </ul>
            );
          case "image":
            return <Media key={i} id={b.mediaId} content={content} />;
        }
      })}
    </div>
  );
}
export function TourCard({
  tour,
  content,
}: {
  tour: Tour;
  content: PublicContent;
}) {
  return (
    <article className="card">
      <Media id={tour.heroMediaId} content={content} />
      <div className="card-body">
        <p className="eyebrow">
          {content.destinations.find((d) => d.id === tour.destinationId)?.name}{" "}
          · {tour.durationDays} ימים
        </p>
        <h3>
          <Link to={tourPath(tour.slug)}>{tour.title}</Link>
        </h3>
        <p>{tour.summary}</p>
      </div>
    </article>
  );
}
export function PostCard({ post }: { post: Post }) {
  return (
    <article className="card card-body">
      <h3>
        <Link to={post.path}>{post.title}</Link>
      </h3>
      <p>{post.excerpt}</p>
    </article>
  );
}
