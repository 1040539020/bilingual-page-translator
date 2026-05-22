describe("content extraction and rendering", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <main>
        <p class="lead" style="font-weight: 600">Hello world from a test page.</p>
        <nav>Skip navigation text.</nav>
        <p data-translated="true">Already translated.</p>
      </main>
    `;
  });

  test("extracts meaningful translatable segments", async () => {
    const { extractTextSegments } = await import("../../content/extraction.js");
    const segments = extractTextSegments(document);

    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("Hello world from a test page.");
    expect(segments[0].format.tagName).toBe("p");
  });

  test("renders dual translation and can clear it", async () => {
    const { renderTranslations, clearTranslations, injectTranslationStyles } = await import("../../content/rendering.js");
    injectTranslationStyles();

    const textNode = document.querySelector(".lead").firstChild;
    const segment = {
      id: "s1",
      text: "Hello world from a test page.",
      nodes: [textNode],
      parent: document.querySelector(".lead"),
      format: {}
    };

    renderTranslations([{ segment, translatedText: "你好，测试页面。", status: "translated" }], {
      mode: "dual",
      displayOrder: "original-first"
    });

    expect(document.querySelector("[data-imt-state='dual']")).not.toBeNull();
    expect(document.querySelector(".imt-translation").textContent).toBe("你好，测试页面。");

    clearTranslations(document.body);
    expect(document.querySelector(".imt-translation")).toBeNull();
  });
});
