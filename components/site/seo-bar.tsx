import { SEO_DESCRIPTION, SEO_TAGLINE } from "@/lib/site-config";

export function SeoBar() {
  return (
    <section className="seo-bar" aria-label="About ParseDeck">
      <div className="seo-bar__inner">
        <p className="seo-bar__tagline">{SEO_TAGLINE}</p>
        <p className="seo-bar__description">{SEO_DESCRIPTION}</p>
      </div>
    </section>
  );
}
