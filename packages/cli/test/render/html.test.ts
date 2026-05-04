import { describe, expect, test } from "bun:test";
import { escapeHtml, renderHtmlReport } from "../../src/render/html";

describe("renderHtmlReport", () => {
  test("renders deterministic standalone HTML with CSP and no external assets", () => {
    const diff = {
      entries: [
        {
          kind: "brand-new" as const,
          dependencyScope: "direct" as const,
          packageName: "new-direct",
          newVersion: "1.0.0",
        },
      ],
    };
    const options = {
      oldLockfilePath: "old.bun.lock",
      newLockfilePath: "new.bun.lock",
    };

    const first = renderHtmlReport(diff, options);
    const second = renderHtmlReport(diff, options);

    expect(first).toBe(second);
    expect(first).toContain("<!doctype html>");
    expect(first).toContain("Content-Security-Policy");
    expect(first).toContain("default-src &#39;none&#39;");
    expect(first).toContain("Brand-new direct packages");
    expect(first).not.toContain("https://");
    expect(first).not.toContain("http://");
    expect(first).not.toContain("//cdn");
    expect(first).not.toContain("<script");
  });

  test("escapes untrusted package names and paths", () => {
    const html = renderHtmlReport(
      {
        entries: [
          {
            kind: "brand-new",
            dependencyScope: "direct",
            packageName: '<script>alert("xss")</script>',
            newVersion: '" onmouseover="alert(1)',
          },
          {
            kind: "added",
            dependencyScope: "transitive",
            packageName: "foo & bar",
            newVersion: "2.0.0",
          },
        ],
      },
      {
        oldLockfilePath: "old<lock>.bun.lock",
        newLockfilePath: "new&lock.bun.lock",
      },
    );

    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(html).toContain("&quot; onmouseover=&quot;alert(1)");
    expect(html).toContain("foo &amp; bar");
    expect(html).toContain("old&lt;lock&gt;.bun.lock");
    expect(html).toContain("new&amp;lock.bun.lock");
    expect(html).not.toContain('<script>alert("xss")</script>');
  });
});

describe("escapeHtml", () => {
  test("escapes HTML special characters", () => {
    expect(escapeHtml(`foo & <bar> "baz" 'qux'`)).toBe(
      "foo &amp; &lt;bar&gt; &quot;baz&quot; &#39;qux&#39;",
    );
  });
});
