import { getTranslatableRoots, isTranslatableElement } from "./detection.js";

const MIN_TEXT_LENGTH = 2;
const SHORT_TEXT_LENGTH = 80;
const MAX_CHUNK_SIZE = 2000;

export function extractTextSegments(doc = document) {
  const roots = getTranslatableRoots(doc);
  const textNodes = roots.flatMap((root) => collectTextNodes(root));
  const grouped = groupAdjacentNodes(textNodes);
  return grouped.flatMap(splitLargeSegment).map((segment, index) => ({
    ...segment,
    id: `imt-segment-${Date.now()}-${index}`
  }));
}

function collectTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = normalizeText(node.textContent || "");
      const parent = node.parentElement;

      if (!parent || text.length < MIN_TEXT_LENGTH) {
        return NodeFilter.FILTER_REJECT;
      }

      if (!isTranslatableElement(parent) || parent.closest("[data-translated='true']")) {
        return NodeFilter.FILTER_REJECT;
      }

      if (!/[^\d\s.,:;!?()[\]{}'"`~@#$%^&*_+=|\\/<>-]/.test(text)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current);
    current = walker.nextNode();
  }

  return nodes;
}

function groupAdjacentNodes(nodes) {
  const segments = [];
  let current = null;

  for (const node of nodes) {
    const parent = node.parentElement;
    const text = normalizeText(node.textContent || "");
    if (!parent || !text) {
      continue;
    }

    const format = getFormattingInfo(parent);
    const canJoin =
      current &&
      current.parent === parent &&
      current.text.length < SHORT_TEXT_LENGTH &&
      text.length < SHORT_TEXT_LENGTH &&
      current.text.length + text.length + 1 <= MAX_CHUNK_SIZE;

    if (canJoin) {
      current.nodes.push(node);
      current.text = `${current.text} ${text}`;
      continue;
    }

    current = {
      text,
      nodes: [node],
      parent,
      format
    };
    segments.push(current);
  }

  return segments;
}

function splitLargeSegment(segment) {
  if (segment.text.length <= MAX_CHUNK_SIZE) {
    return [segment];
  }

  const chunks = [];
  let remaining = segment.text;

  while (remaining.length > 0) {
    let chunk = remaining.slice(0, MAX_CHUNK_SIZE);
    const splitAt = Math.max(chunk.lastIndexOf("。"), chunk.lastIndexOf("."), chunk.lastIndexOf("\n"), chunk.lastIndexOf(" "));
    if (splitAt > MAX_CHUNK_SIZE * 0.5) {
      chunk = chunk.slice(0, splitAt + 1);
    }

    chunks.push({
      ...segment,
      text: chunk.trim()
    });
    remaining = remaining.slice(chunk.length).trim();
  }

  return chunks.filter((chunk) => chunk.text);
}

function getFormattingInfo(element) {
  return {
    tagName: element.tagName.toLowerCase(),
    className: element.className || "",
    inlineStyle: element.getAttribute("style") || ""
  };
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}
