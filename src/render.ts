import { Editor, GlyphsInterface } from "./rich-text";
import { Layer } from "konva/lib/Layer";

import Konva from "konva";

const theme_color = [11, 153, 255, 1] as [number, number, number, number];
let emoji_image = new Map<string, ImageBitmap>();

export const renderBaseLine = (
  layer: Layer,
  editorRef: React.MutableRefObject<Editor | undefined>
) => {
  const editor = editorRef.current;
  if (!editor || !editor.derivedTextData) return;
  const { baselines } = editor.derivedTextData;
  if (!baselines?.length) return;

  // 渲染基线
  for (let i = 0; i < baselines?.length; i++) {
    const baseline = baselines[i];
    const konva_rect = new Konva.Rect({
      ...baseline.position,
      width: baseline.width,
      height: 1,
      fill: `rgba(${theme_color[0]},${theme_color[1]},${theme_color[2]},${theme_color[3]})`,
    });
    layer.add(konva_rect);
  }
};

export const renderBorder = (
  layer: Layer,
  editorRef: React.MutableRefObject<Editor | undefined>
) => {
  const editor = editorRef.current!;
  const { width, height } = editor;
  const size = 2;
  if (editor.isEditor) {
    const konva_rect = new Konva.Rect({
      x: 0,
      y: 0,
      width,
      height,
      stroke: `rgba(${theme_color[0]},${theme_color[1]},${theme_color[2]},${theme_color[3]})`,
    });
    layer.add(konva_rect);
    return;
  }
  const rect1 = [-size, -size, size * 2, size * 2];
  const rect2 = [width - size * 2, -size, width + size, size * 2];
  const rect3 = [-size, height - size * 2, size * 2, height + size];
  const rect4 = [
    width - size * 2,
    height - size * 2,
    width + size,
    height + size,
  ];

  const konva_rect = new Konva.Rect({
    x: 0,
    y: 0,
    width,
    height,
    stroke: `rgba(${theme_color[0]},${theme_color[1]},${theme_color[2]},${theme_color[3]})`,
  });
  layer.add(konva_rect);

  [rect1, rect2, rect3, rect4].map((rect) => {
    const konva_rect = new Konva.Rect({
      x: rect[0],
      y: rect[1],
      width: rect[2] - rect[0],
      height: rect[3] - rect[1],
      stroke: `rgba(${theme_color[0]},${theme_color[1]},${theme_color[2]},${theme_color[3]})`,
      fill: "rgba(255,255,255,1)",
    });
    layer.add(konva_rect);
  });
};

export const renderText = (
  layer: Layer,
  editorRef: React.MutableRefObject<Editor | undefined>
) => {
  const editor = editorRef.current;
  if (!editor || !editor.derivedTextData) return;
  const { glyphs } = editor.derivedTextData;
  if (!glyphs?.length) return;
  const fillPaintsArr = editor.getFillPaintsForGlyphs();

  const renderGlyph = (glyphs: GlyphsInterface[], len: number) => {
    for (let idx = 0; idx < len; idx++) {
      const glyph = glyphs[idx];
      if (!glyph.commandsBlob) continue;
      for (let j = 0; j < fillPaintsArr[idx].length; j++) {
        const fillPaint = fillPaintsArr[idx][j];
        if (!fillPaint.visible) continue;
        const path = new Konva.Path({
          ...glyph.position,
          data: glyph.commandsBlob,
          fill: `rgba(${fillPaint.color.r * 255},${fillPaint.color.g * 255},${
            fillPaint.color.b * 255
          },${fillPaint.opacity})`,
        });
        layer.add(path);
      }
    }
  };
  const renderEmoji = (glyphs: GlyphsInterface[], len: number) => {
    for (let idx = 0; idx < len; idx++) {
      const glyph = glyphs[idx];
      if (!glyph.emojiCodePoints?.length) continue;
      const key = glyph.emojiCodePoints
        .map((item) => item.toString(16))
        .join("-");

      const renderImage = (image?: ImageBitmap) => {
        if (!image || !glyph.emojiRect?.length) return;

        const konva_image = new Konva.Image({
          x: glyph.emojiRect[0],
          y: glyph.emojiRect[1],
          image,
          width: glyph.emojiRect[2] - glyph.emojiRect[0],
          height: glyph.emojiRect[3] - glyph.emojiRect[1],
        });
        layer.add(konva_image);
      };

      if (!emoji_image.has(key)) {
        emoji_image.set(key, null!);
        fetch(`https://static.figma.com/emoji/5/apple/medium/${key}.png`).then(
          async (res) => {
            if (res.ok) {
              const buffer = await res.arrayBuffer();
              const blob = new Blob([buffer]);
              const image = await createImageBitmap(blob);

              emoji_image.set(key, image!);
              if (image) renderImage(image);
            } else {
              console.warn(`请求emoji ${key}失败`);
              emoji_image.set(key, null!);
            }
          }
        );
      } else {
        const image = emoji_image.get(key);
        renderImage(image);
      }
    }
  };
  const renderTextDecoration = (len: number) => {
    const rects = editor.getTextDecorationRects();
    for (let idx = 0; idx < len; idx++) {
      const rect = rects[idx];
      if (!rect || rect[2] === 0) continue;
      for (let j = 0; j < fillPaintsArr[idx].length; j++) {
        const fillPaint = fillPaintsArr[idx][j];
        if (!fillPaint.visible) continue;
        // 注意：这里alpha取opacity
        const konva_rect = new Konva.Rect({
          x: rect[0],
          y: rect[1],
          width: rect[2],
          height: rect[3],
          fill: `rgba(${fillPaint.color.r * 255},${fillPaint.color.g * 255},${
            fillPaint.color.b * 255
          },${fillPaint.opacity})`,
        });
        layer.add(konva_rect);
      }
    }
  };

  // 编辑态文本渲染
  if (editor.hasSelection()) {
    let len = glyphs?.length;
    if (
      editor.style.textTruncation === "ENABLE" &&
      editor.style.truncationStartIndex > -1
    ) {
      len = editor.style.truncationStartIndex;
    }
    for (let i = 0; i < glyphs?.length; i++) {
      const glyph = glyphs[i];
      // 渲染省略内容
      if (
        editor.style.textTruncation === "ENABLE" &&
        editor.style.truncationStartIndex > -1 &&
        i >= editor.style.truncationStartIndex
      ) {
        const path = new Konva.Path({
          ...glyph.position,
          data: glyph.commandsBlob,
          fill: `rgba(153,153,153,1.0)`,
        });
        layer.add(path);
        continue;
      }
    }

    renderGlyph(glyphs, glyphs?.length);
    renderEmoji(glyphs, glyphs?.length);
    renderTextDecoration(len);
  } else {
    let len = glyphs?.length;

    // 渲染省略号
    if (
      editor.style.textTruncation === "ENABLE" &&
      editor.style.truncationStartIndex > -1
    ) {
      len = editor.style.truncationStartIndex;
      const glyph = glyphs[len - 1];
      if (!glyph) {
        console.warn("renderText exception");
        return;
      }

      const xAdvance = glyph.xAdvance ?? 0;
      const fillPaints = fillPaintsArr[len - 2];
      for (let i = 0; i < 3; i++) {
        let [x, y] = [glyph.position.x + xAdvance * i, glyph.position.y];
        for (let j = 0; j < fillPaints.length; j++) {
          const fillPaint = fillPaints[j];
          if (!fillPaint.visible) continue;
          // 注意：这里alpha取opacity
          const path = new Konva.Path({
            x,
            y,
            data: glyph.commandsBlob,
            fill: `rgba(${fillPaint.color.r * 255},${fillPaint.color.g * 255},${
              fillPaint.color.b * 255
            },${fillPaint.opacity})`,
          });
          layer.add(path);
        }
      }
    }

    renderGlyph(glyphs, len);
    renderEmoji(glyphs, len);
    renderTextDecoration(len);
  }
};

export const renderCursor = (
  layer: Layer,
  editorRef: React.MutableRefObject<Editor | undefined>
) => {
  if (!editorRef.current) return;
  const editor = editorRef.current;
  const rects = editor.getSelectionRects();
  let color = [0, 0, 0, 1];
  let alpha = 1;
  if (rects.length > 0 && !editor.isCollapse()) {
    color = theme_color;
    alpha = 0.3;
  }
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const konva_rect = new Konva.Rect({
      x: rect[0],
      y: rect[1],
      width: rect[2],
      height: rect[3],
      fill: `rgba(${color[0]},${color[1]},${color[2]},${alpha})`,
    });
    layer.add(konva_rect);
  }
};
