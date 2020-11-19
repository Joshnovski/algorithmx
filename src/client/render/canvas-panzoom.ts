import * as d3 from './d3.modules';
import { PartialEvalAttr, FullEvalAttr } from '../attributes/derived';
import { CanvasSpec } from '../attributes/components/canvas';
import { renderAnimAttr } from './common';
import { D3Selection, D3ZoomBehaviour } from './utils';
import {
    selectCanvasContainer,
    selectInnerCanvas,
    selectEdgeGroup,
    selectNodeGroup,
    selectNode,
    selectCanvas,
} from './selectors';
import { AnimAttrSpec } from '../attributes/components/animation';

export const updatePanZoomBehaviour = (
    canvasSel: D3Selection,
    attrs: FullEvalAttr<CanvasSpec>,
    changes: PartialEvalAttr<CanvasSpec>,
    zoomBehaviour: D3ZoomBehaviour | undefined
): D3ZoomBehaviour => {
    if (
        changes.panlimit ||
        changes.zoomlimit ||
        changes.zoomtoggle ||
        zoomBehaviour === undefined
    ) {
        const panlimit = changes.panlimit ?? attrs.panlimit;
        const zoomlimit = changes.zoomlimit ?? attrs.zoomlimit;
        const zoomtoggle = changes.zoomtoggle ?? attrs.zoomtoggle;
        const newZoomBehaviour = d3
            .zoom()
            .translateExtent([
                [-panlimit[0], -panlimit[1]],
                [panlimit[0], panlimit[1]],
            ])
            .scaleExtent([zoomlimit[0], zoomlimit[1]])
            .on('zoom', (event) => selectInnerCanvas(canvasSel).attr('transform', event.transform))
            .filter((event) =>
                zoomtoggle && event.type === 'wheel' ? event.ctrlKey || event.metaKey : true
            );

        canvasSel.call(newZoomBehaviour);
        return newZoomBehaviour;
    } else return zoomBehaviour;
};

export const renderPanZoom = (
    canvasSel: D3Selection,
    attrs: FullEvalAttr<CanvasSpec>,
    changes: PartialEvalAttr<CanvasSpec>,
    zoomBehaviour: D3ZoomBehaviour
) => {
    const panZoomAnim = changes.pan ?? changes.zoom ?? changes.size;
    if (panZoomAnim !== undefined) {
        renderAnimAttr(canvasSel, [panZoomAnim, 'pan-zoom'], [attrs, changes], (s, a) => {
            const size = a.size?.value ?? attrs.size.value;
            const pan = a.pan?.value ?? attrs.pan.value;
            const zoom = a.zoom?.value ?? attrs.zoom.value;
            const panCenter: [number, number] = [
                size[0] / 2 - pan[0] * zoom,
                size[1] / 2 + pan[1] * zoom,
            ];
            const transform = d3.zoomIdentity.translate(panCenter[0], panCenter[1]).scale(zoom);

            return s.call(zoomBehaviour.transform, transform);
        });
    }
};
