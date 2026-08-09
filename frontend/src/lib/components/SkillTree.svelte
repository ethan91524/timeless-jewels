<script lang="ts">
  import { Canvas, Layer, t } from 'svelte-canvas';
  import type { RenderFunc, Node } from '../skill_tree_types';
  import {
    baseJewelRadius,
    calculateNodePos,
    distance,
    drawnGroups,
    drawnNodes,
    formatStats,
    inverseSprites,
    inverseSpritesActive,
    inverseTranslations,
    orbitAngleAt,
    skillTree,
    toCanvasCoords
  } from '../skill_tree';
  import type { Point } from '../skill_tree';
  import { derived } from 'svelte/store';
  import { calculator, data } from '../types';

  export let clickNode: (node: Node) => void;
  export let circledNode: number | undefined;

  export let selectedJewel: number;
  export let selectedConqueror: string;
  export let seed: number;
  export let highlighted: number[] = [];
  export let disabled: number[] = [];
  export let highlightJewels = false;

  const slowTime = derived(t, (values) => {
    if ((!highlighted || !highlighted.length) && !highlightJewels) {
      return 0;
    }

    return Math.round(values / 40);
  });

  const startGroups = [427, 320, 226, 227, 323, 422, 329];

  const titleFont = '25px Roboto Mono';
  const statsFont = '17px Roboto Mono';

  let scaling = 10;

  let offsetX = 0;
  let offsetY = 0;

  $: jewelRadius = baseJewelRadius / scaling;

  const drawScaling = 2.6;

  const spriteCache: Record<string, HTMLImageElement> = {};
  const spriteCacheActive: Record<string, HTMLImageElement> = {};
  const drawSprite = (
    context: CanvasRenderingContext2D,
    path: string,
    pos: Point,
    active = false,
    mirrored = false
  ) => {
    let sprite = active ? inverseSpritesActive[path] : inverseSprites[path];

    if (!sprite && active) {
      sprite = inverseSprites[path];
    }

    const spriteSheetUrl = sprite.filename;

    if (!(spriteSheetUrl in (active ? spriteCacheActive : spriteCache))) {
      (active ? spriteCacheActive : spriteCache)[spriteSheetUrl] = new Image();
      (active ? spriteCacheActive : spriteCache)[spriteSheetUrl].src = spriteSheetUrl;
    }

    const self = sprite.coords[path];

    const newWidth = (self.w / scaling) * drawScaling;
    const newHeight = (self.h / scaling) * drawScaling;

    const topLeftX = pos.x - newWidth / 2;
    const topLeftY = pos.y - newHeight / 2;

    let finalY = topLeftY;

    if (mirrored) {
      finalY = topLeftY - newHeight / 2;
    }

    context.drawImage(
      (active ? spriteCacheActive : spriteCache)[spriteSheetUrl],
      self.x,
      self.y,
      self.w,
      self.h,
      topLeftX,
      finalY,
      newWidth,
      newHeight
    );

    if (mirrored) {
      context.save();

      context.translate(topLeftX, topLeftY);
      context.rotate(Math.PI);

      context.drawImage(
        (active ? spriteCacheActive : spriteCache)[spriteSheetUrl],
        self.x,
        self.y,
        self.w,
        self.h,
        -newWidth,
        -(newHeight / 2),
        newWidth,
        -newHeight
      );

      context.restore();
    }
  };

  const wrapText = (text: string, context: CanvasRenderingContext2D, width: number): string[] => {
    const result = [];

    let currentWord = '';
    text.split(' ').forEach((word) => {
      if (context.measureText(currentWord + word).width < width) {
        currentWord += ' ' + word;
      } else {
        result.push(currentWord.trim());
        currentWord = word;
      }
    });
    61834;

    if (currentWord.length > 0) {
      result.push(currentWord.trim());
    }

    return result;
  };

  let mousePos: Point = {
    x: Number.MIN_VALUE,
    y: Number.MIN_VALUE
  };

  let cursor = 'unset';

  let hoveredNode: Node | undefined;
  $: render = (({ context, width, height }) => {
    const start = window.performance.now();

    context.clearRect(0, 0, width, height);

    context.fillStyle = '#080c11';
    context.fillRect(0, 0, width, height);

    const connected = {};
    Object.keys(drawnGroups).forEach((groupId) => {
      const group = drawnGroups[groupId];
      const groupPos = toCanvasCoords(group.x, group.y, offsetX, offsetY, scaling);

      const maxOrbit = Math.max(...group.orbits);
      if (startGroups.indexOf(parseInt(groupId)) >= 0) {
        // Do not draw starter nodes
      } else if (maxOrbit == 1) {
        drawSprite(context, 'PSGroupBackground1', groupPos, false);
      } else if (maxOrbit == 2) {
        drawSprite(context, 'PSGroupBackground2', groupPos, false);
      } else if (maxOrbit == 3 || group.orbits.length > 1) {
        drawSprite(context, 'PSGroupBackground3', groupPos, false, true);
        // drawMirror(context, $PSGroupBackground3, groupPos);
      }
    });

    Object.keys(drawnNodes).forEach((nodeId) => {
      const node = drawnNodes[nodeId];
      const angle = orbitAngleAt(node.orbit, node.orbitIndex);
      const rotatedPos = calculateNodePos(node, offsetX, offsetY, scaling);

      node.out?.forEach((o) => {
        if (!drawnNodes[parseInt(o)]) {
          return;
        }

        const min = Math.min(parseInt(o), parseInt(nodeId));
        const max = Math.max(parseInt(o), parseInt(nodeId));
        const joined = min + ':' + max;

        if (joined in connected) {
          return;
        }
        connected[joined] = true;

        const targetNode = drawnNodes[parseInt(o)];
        if (!targetNode) {
          return;
        }

        // Do not draw connections to mastery nodes
        if (targetNode.isMastery) {
          return;
        }

        const targetAngle = orbitAngleAt(targetNode.orbit, targetNode.orbitIndex);
        const targetRotatedPos = calculateNodePos(targetNode, offsetX, offsetY, scaling);

        context.beginPath();

        if (node.group != targetNode.group || node.orbit != targetNode.orbit) {
          context.moveTo(rotatedPos.x, rotatedPos.y);
          context.lineTo(targetRotatedPos.x, targetRotatedPos.y);
        } else {
          let a = Math.PI / 180 - (Math.PI / 180) * angle;
          let b = Math.PI / 180 - (Math.PI / 180) * targetAngle;

          a -= Math.PI / 2;
          b -= Math.PI / 2;

          const diff = Math.abs(Math.max(a, b) - Math.min(a, b));

          const finalA = diff > Math.PI ? Math.max(a, b) : Math.min(a, b);
          const finalB = diff > Math.PI ? Math.min(a, b) : Math.max(a, b);

          const group = drawnGroups[node.group];
          const groupPos = toCanvasCoords(group.x, group.y, offsetX, offsetY, scaling);
          context.arc(groupPos.x, groupPos.y, skillTree.constants.orbitRadii[node.orbit] / scaling + 1, finalA, finalB);
        }

        context.lineWidth = 6 / scaling;
        context.strokeStyle = `#524518`;
        context.stroke();
      });
    });

    let circledNodePos: Point;
    if (circledNode) {
      circledNodePos = calculateNodePos(drawnNodes[circledNode], offsetX, offsetY, scaling);
      context.strokeStyle = '#ad2b2b';
    }

    let hoveredNodeActive = false;
    let newHoverNode: Node | undefined;
    Object.keys(drawnNodes).forEach((nodeId) => {
      const node = drawnNodes[nodeId];
      const rotatedPos = calculateNodePos(node, offsetX, offsetY, scaling);
      let touchDistance = 0;

      let active = false;
      if (circledNode) {
        if (distance(rotatedPos, circledNodePos) < jewelRadius) {
          active = true;
        }
      }

      if (disabled.indexOf(node.skill) >= 0) {
        active = false;
      }

      if (node.isKeystone) {
        touchDistance = 110;
        drawSprite(context, node.icon, rotatedPos, active);
        if (active) {
          drawSprite(context, 'KeystoneFrameAllocated', rotatedPos, false);
        } else {
          drawSprite(context, 'KeystoneFrameUnallocated', rotatedPos, false);
        }
      } else if (node.isNotable) {
        touchDistance = 70;
        drawSprite(context, node.icon, rotatedPos, active);
        if (active) {
          drawSprite(context, 'NotableFrameAllocated', rotatedPos, false);
        } else {
          drawSprite(context, 'NotableFrameUnallocated', rotatedPos, false);
        }
      } else if (node.isJewelSocket) {
        touchDistance = 70;
        if (node.expansionJewel) {
          if (active) {
            drawSprite(context, 'JewelSocketAltNormal', rotatedPos, false);
          } else {
            drawSprite(context, 'JewelSocketAltNormal', rotatedPos, false);
          }
        } else {
          if (active) {
            drawSprite(context, 'JewelFrameAllocated', rotatedPos, false);
          } else {
            drawSprite(context, 'JewelFrameUnallocated', rotatedPos, false);
          }
        }
      } else if (node.isMastery) {
        drawSprite(context, node.inactiveIcon, rotatedPos, active);
      } else {
        touchDistance = 50;
        drawSprite(context, node.icon, rotatedPos, active);
        if (active) {
          drawSprite(context, 'PSSkillFrameActive', rotatedPos, false);
        } else {
          drawSprite(context, 'PSSkillFrame', rotatedPos, false);
        }
      }

      if (highlighted.indexOf(node.skill) >= 0 || (highlightJewels && node.isJewelSocket)) {
        context.strokeStyle = `hsl(${$slowTime}, 100%, 50%)`;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(rotatedPos.x, rotatedPos.y, (touchDistance + 30) / scaling, 0, Math.PI * 2);
        context.stroke();
      }

      if (distance(rotatedPos, mousePos) < touchDistance / scaling) {
        newHoverNode = node;
        hoveredNodeActive = active;
      }
    });

    hoveredNode = newHoverNode;

    if (circledNode) {
      context.strokeStyle = '#ad2b2b';
      context.lineWidth = 1;
      context.beginPath();
      context.arc(circledNodePos.x, circledNodePos.y, jewelRadius, 0, Math.PI * 2);
      context.stroke();
    }

    if (hoveredNode) {
      let nodeName = hoveredNode.name;
      let nodeStats: { text: string; special: boolean }[] = (hoveredNode.stats || []).map((s) => ({
        text: s,
        special: false
      }));

      if (!hoveredNode.isJewelSocket && hoveredNodeActive) {
        if (hoveredNode.skill && seed && selectedJewel && selectedConqueror) {
          const result = calculator.Calculate(
            data.TreeToPassive[hoveredNode.skill].Index,
            seed,
            selectedJewel,
            selectedConqueror
          );

          if (result) {
            if ('AlternatePassiveSkill' in result && result.AlternatePassiveSkill) {
              nodeStats = [];
              nodeName = result.AlternatePassiveSkill.Name;

              if ('StatsKeys' in result.AlternatePassiveSkill) {
                result.AlternatePassiveSkill.StatsKeys.forEach((statId, i) => {
                  const stat = data.GetStatByIndex(statId);
                  const translation = inverseTranslations[stat.ID] || '';
                  if (translation) {
                    nodeStats.push({
                      text: formatStats(translation, result.StatRolls[i]) || stat.ID,
                      special: true
                    });
                  }
                });
              }
            }

            if (result.AlternatePassiveAdditionInformations) {
              result.AlternatePassiveAdditionInformations.forEach((info) => {
                if ('StatsKeys' in info.AlternatePassiveAddition) {
                  info.AlternatePassiveAddition.StatsKeys.forEach((statId, i) => {
                    const stat = data.GetStatByIndex(statId);
                    const translation = inverseTranslations[stat.ID] || '';
                    if (translation) {
                      nodeStats.push({
                        text: formatStats(translation, info.StatRolls[i]) || stat.ID,
                        special: true
                      });
                    }
                  });
                }
              });
            }
          }
        }
      }

      context.font = titleFont;
      const textMetrics = context.measureText(nodeName);

      const maxWidth = Math.max(textMetrics.width + 50, 600);

      context.font = statsFont;

      const allLines: {
        text: string;
        offset: number;
        special: boolean;
      }[] = [];

      const padding = 30;

      let offset = 85;

      if (nodeStats && nodeStats.length > 0) {
        nodeStats.forEach((stat) => {
          if (allLines.length > 0) {
            offset += 5;
          }

          stat.text.split('\n').forEach((line) => {
            if (allLines.length > 0) {
              offset += 10;
            }

            const lines = wrapText(line, context, maxWidth - padding);
            lines.forEach((l) => {
              allLines.push({
                text: l,
                offset,
                special: stat.special
              });
              offset += 20;
            });
          });
        });
      } else if (hoveredNode.isJewelSocket) {
        allLines.push({
          text: 'Click to select this socket',
          offset,
          special: true
        });

        offset += 20;
      }

      const titleHeight = 55;

      context.fillStyle = 'rgba(75,63,24,0.9)';
      context.fillRect(mousePos.x, mousePos.y, maxWidth, titleHeight);

      context.fillStyle = '#ffffff';
      context.font = titleFont;
      context.textAlign = 'center';
      context.fillText(nodeName, mousePos.x + maxWidth / 2, mousePos.y + 35);

      context.fillStyle = 'rgba(0,0,0,0.8)';
      context.fillRect(mousePos.x, mousePos.y + titleHeight, maxWidth, offset - titleHeight);

      context.font = statsFont;
      context.textAlign = 'left';
      allLines.forEach((l) => {
        if (l.special) {
          context.fillStyle = '#8cf34c';
        } else {
          context.fillStyle = '#ffffff';
        }

        context.fillText(l.text, mousePos.x + padding / 2, mousePos.y + l.offset);
      });
    }

    if (hoveredNode && hoveredNode.isJewelSocket) {
      cursor = 'pointer';
    } else {
      cursor = 'unset';
    }

    context.fillStyle = '#ffffff';
    context.textAlign = 'right';
    context.font = '12px Roboto Mono';

    const end = window.performance.now();

    context.fillText(`${(end - start).toFixed(1)}ms`, width - 5, 17);
  }) as RenderFunc;

  let downX = 0;
  let downY = 0;

  let startX = 0;
  let startY = 0;

  let container: HTMLDivElement;

  // 座標一律換算成畫布座標再用。原本用 event.offsetX（相對於「事件目標」），
  // 手指或滑鼠一滑到畫布以外的元素上，座標系就整個換掉 → 畫面會跳、像卡住。
  const toCanvas = (event: { clientX: number; clientY: number }) => {
    const rect = container?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0)
    };
  };

  // 多指：兩指就是縮放，一指才是拖曳
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;
  let pinchScaling = 0;

  const pointerList = () => [...pointers.values()];
  const pinchCenter = () => {
    const [a, b] = pointerList();
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const pinchSpread = () => {
    const [a, b] = pointerList();
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  let down = false;
  const mouseDown = (event: PointerEvent) => {
    const pos = toCanvas(event);
    pointers.set(event.pointerId, pos);
    // 抓住這根指頭/游標，移出畫布也還收得到事件
    (event.target as Element)?.setPointerCapture?.(event.pointerId);

    if (pointers.size === 2) {
      down = false;
      pinchDistance = pinchSpread();
      pinchScaling = scaling;
      return;
    }

    down = true;
    downX = pos.x;
    downY = pos.y;
    startX = offsetX;
    startY = offsetY;

    mousePos = pos;

    if (hoveredNode) {
      clickNode(hoveredNode);
    }
  };

  const mouseUp = (event: PointerEvent) => {
    if (event.type === 'pointerup' || event.type === 'pointercancel') {
      pointers.delete(event.pointerId);
      down = false;
      pinchDistance = 0;
      // 兩指放開其中一根：剩下那根重新當作拖曳起點，畫面才不會跳
      if (pointers.size === 1) {
        const [p] = pointerList();
        downX = p.x;
        downY = p.y;
        startX = offsetX;
        startY = offsetY;
        down = true;
      }
    }

    mousePos = toCanvas(event);
  };

  const mouseMove = (event: PointerEvent) => {
    const pos = toCanvas(event);
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, pos);
    }

    if (pointers.size >= 2 && pinchDistance > 0) {
      // 捏合縮放：以兩指中點為錨點，跟滾輪縮放同一套公式
      const spread = pinchSpread();
      if (spread > 0) {
        const newScaling = Math.min(30, Math.max(3, pinchScaling * (pinchDistance / spread)));
        const dScale = newScaling - scaling;
        if (dScale !== 0) {
          const center = pinchCenter();
          offsetX += center.x * dScale;
          offsetY += center.y * dScale;
          scaling = newScaling;
        }
      }
      mousePos = pos;
      return;
    }

    if (down) {
      offsetX = startX - (downX - pos.x) * scaling;
      offsetY = startY - (downY - pos.y) * scaling;
    }

    mousePos = pos;
  };

  const onScrollRaw = (event: WheelEvent) => {
    // Keep the world point under the cursor invariant during zoom. From
    // toCanvasCoords: canvasX = (worldX + |min_x| + offsetX) / scaling, so
    // for a fixed canvas point P the offset must change by P * Δscale
    // when scaling changes. Using the actual clamped delta (not assuming ±1)
    // makes zoom track the mouse correctly for trackpads, hi-res wheels, and
    // at the scale clamps.
    const pos = toCanvas(event);
    const newScaling = Math.min(30, Math.max(3, scaling + event.deltaY / 100));
    const dScale = newScaling - scaling;
    if (dScale !== 0) {
      offsetX += pos.x * dScale;
      offsetY += pos.y * dScale;
      scaling = newScaling;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  let width = 0;
  let height = 0;
  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
  };

  let initialized = false;
  $: {
    if (!initialized && skillTree) {
      initialized = true;
      offsetX = skillTree.min_x + (window.innerWidth / 2) * scaling;
      offsetY = skillTree.min_y + (window.innerHeight / 2) * scaling;
    }
    resize();
  }
</script>

<svelte:window
  on:pointerup={mouseUp}
  on:pointercancel={mouseUp}
  on:pointermove={mouseMove}
  on:resize={resize} />

{#if width && height}
  <div bind:this={container} on:resize={resize} style="touch-action: none; cursor: {cursor}">
    <Canvas {width} {height} on:pointerdown={mouseDown} on:wheel={onScrollRaw}>
      <Layer {render} />
    </Canvas>
    <slot />
  </div>
{/if}
