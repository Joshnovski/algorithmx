import {
    AttrType,
    DictSpec,
    RecordSpec,
    BoolSpec,
    NumSpec,
    AnyStringSpec,
    StringSpec,
    TupleSpec,
    Entries,
} from '../attr-spec';
import {
    ElementSpec,
    SvgSpec,
    elementSpecEntries,
    svgSpecEntries,
    elementDefaults,
    svgDefaults,
} from './element';
import { WithCommonSpec, withCommonSpec, commonDefaults } from './common';
import { LabelSpec, labelSpec, labelDefaults, createLabelDictDefaults } from './label';
import { NodeSpec, nodeSpec, createNodeDictDefaults, evalNode } from './node';
import { EdgeSpec, edgeSpec, createEdgeDictDefaults } from './edge';
import { COLORS } from '../../render/utils';
import { FullAttr, PartialAttr } from '../derived-attr';
import { mergeDiff, mapDict } from '../../utils';
import { VarDict, evalAttr, usesVars, evalDeep } from '../expr-utils';
import { CanvasVar } from './expression';
import { combineAttrs } from '../attr-utils';

export const edgeLengthType = <const>['individual', 'symmetric', 'jaccard'];
export type EdgeLengthType = typeof edgeLengthType[number];

export type CanvasSpec = RecordSpec<
    {
        readonly nodes: DictSpec<NodeSpec>;
        readonly edges: DictSpec<EdgeSpec>;
        readonly labels: DictSpec<LabelSpec>;
        readonly size: WithCommonSpec<TupleSpec<NumSpec>>;
        readonly edgelengthtype: WithCommonSpec<StringSpec<EdgeLengthType>>;
        readonly edgelength: WithCommonSpec<NumSpec>;
        readonly pan: WithCommonSpec<TupleSpec<NumSpec>>;
        readonly zoom: WithCommonSpec<NumSpec>;
        readonly panlimit: WithCommonSpec<TupleSpec<NumSpec>>;
        readonly zoomlimit: WithCommonSpec<TupleSpec<NumSpec>>;
        readonly zoomkey: WithCommonSpec<BoolSpec>;
    } & Entries<ElementSpec> &
        Entries<SvgSpec>
>;

export const canvasSpec: CanvasSpec = {
    type: AttrType.Record,
    entries: {
        nodes: {
            type: AttrType.Dict,
            entry: nodeSpec,
        },
        edges: {
            type: AttrType.Dict,
            entry: edgeSpec,
        },
        labels: {
            type: AttrType.Dict,
            entry: labelSpec,
        },
        size: withCommonSpec({ type: AttrType.Tuple, entry: { type: AttrType.Number } }),
        edgelengthtype: withCommonSpec({ type: AttrType.String, validValues: edgeLengthType }),
        edgelength: withCommonSpec({ type: AttrType.Number }),
        pan: withCommonSpec({ type: AttrType.Tuple, entry: { type: AttrType.Number } }),
        zoom: withCommonSpec({ type: AttrType.Number }),
        panlimit: withCommonSpec({ type: AttrType.Tuple, entry: { type: AttrType.Number } }),
        zoomlimit: withCommonSpec({ type: AttrType.Tuple, entry: { type: AttrType.Number } }),
        zoomkey: withCommonSpec({ type: AttrType.Boolean }),
        ...elementSpecEntries,
        ...svgSpecEntries,
    },
};

export const canvasDefaults: FullAttr<CanvasSpec> = {
    nodes: {},
    edges: {},
    labels: {},
    size: {
        ...commonDefaults,
        value: [100, 100],
        duration: 0,
    },
    edgelengthtype: { ...commonDefaults, value: 'jaccard' },
    edgelength: { ...commonDefaults, value: 70 },
    pan: { ...commonDefaults, value: [0, 0] },
    zoom: { ...commonDefaults, value: 1 },
    panlimit: { ...commonDefaults, value: [Infinity, Infinity] },
    zoomlimit: { ...commonDefaults, value: [0.1, 10] },
    zoomkey: { ...commonDefaults, value: false },
    ...elementDefaults,
    ...svgDefaults,
};

export const createCanvasDefaults = (
    attrs: FullAttr<CanvasSpec> | undefined,
    changes: PartialAttr<CanvasSpec>
): FullAttr<CanvasSpec> => {
    return {
        ...canvasDefaults,
        nodes: createNodeDictDefaults(attrs?.nodes, changes.nodes ?? {}),
        edges: createEdgeDictDefaults(attrs?.edges, changes.edges ?? {}),
        labels: mapDict(createLabelDictDefaults(attrs?.labels, changes.labels ?? {}), (label) =>
            mergeDiff(label, {
                align: { value: 'middle' },
                pos: { value: [0, { m: 0.5, x: 'cy', c: 0 }] },
                rotate: { value: true },
                color: { value: COLORS.gray },
                size: { value: 20 },
            })
        ),
    };
};

export const evalCanvas = (
    attrs: FullAttr<CanvasSpec> | undefined,
    changes: PartialAttr<CanvasSpec>,
    selfRefOnly: boolean
): PartialAttr<NodeSpec> => {
    // get node variables from attributes
    const canvasVars: VarDict<CanvasVar> = {
        cx: evalAttr(attrs?.size.value[0], changes.size?.value?.[0], {}),
        cy: evalAttr(attrs?.size.value[1], changes.size?.value?.[1], {}),
    };

    // evaluate child attributes
    return combineAttrs(
        canvasSpec,
        attrs,
        changes,
        (childAttr, childChanges, childKey, childSpec) => {
            if (childKey === 'nodes') {
                return combineAttrs(
                    canvasSpec.entries.nodes,
                    attrs?.nodes,
                    changes.nodes,
                    (nodeAttrs, nodeChanges) => {
                        if (nodeChanges)
                            return evalNode(
                                nodeAttrs as FullAttr<NodeSpec> | undefined,
                                nodeChanges,
                                canvasVars,
                                selfRefOnly
                            );

                        if (!selfRefOnly)
                            return evalDeep(nodeSpec, nodeAttrs, nodeChanges, canvasVars);

                        return undefined;
                    }
                );
            }

            if (selfRefOnly) {
                // only evaluate self-referential attributes (e.g. size = '2cx')
                if (
                    childKey === 'size' &&
                    changes.size!.value &&
                    (usesVars(changes.size!.value[0], ['cx', 'cy']) ||
                        usesVars(changes.size!.value[1], ['cx', 'cy']))
                ) {
                    return evalDeep(childSpec, childAttr, childChanges, canvasVars);
                }

                return childChanges;
            }

            return evalDeep(childSpec, childAttr, childChanges, canvasVars);
        }
    );
};

/*
export const removeInvalidEdges = (
    attrs: FullAttr<CanvasSpec> | undefined,
    changes: PartialAttr<CanvasSpec>
): PartialAttr<CanvasSpec> => {
    // remove edges connecting non-existent nodes
    const prevEdges = prevAttr ? prevAttr.edges : ({} as AttrLookup<IEdgeAttr>);
    const newEdges = attrUtils.newLookupEntries(prevEdges, changes.edges || {}) as AttrLookup<
        IEdgeAttr
    >;
    const prevNodes = prevAttr ? prevAttr.nodes : ({} as AttrLookup<NodeSpec>);
    const changedNodes = changes.nodes || {};

    const invalidEdges = Object.entries(prevEdges)
        .concat(Object.entries(newEdges))
        .reduce((result, [k, edge]) => {
            if (
                changedNodes[edge.source] === null ||
                (!prevNodes[edge.source] && !changedNodes[edge.source])
            )
                return { ...result, [k]: null };
            else if (
                changedNodes[edge.target] === null ||
                (!prevNodes[edge.target] && !changedNodes[edge.target])
            )
                return { ...result, [k]: null };
            else return result;
        }, {} as PartialAttr<CanvasSpec['edges']>);

    return { edges: invalidEdges };
};
*/
