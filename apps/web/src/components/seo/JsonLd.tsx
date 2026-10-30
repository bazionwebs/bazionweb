type JsonLdProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
};

/** Emits validated schema.org structured data. Server-component safe. */
export default function JsonLd({ data }: JsonLdProps) {
  // Escape `<` as `\u003c` to prevent `</script>` breakouts in JSON-LD
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
