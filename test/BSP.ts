
import { expect, assert } from "chai";
import 'mocha'
import { BSPnode, Edge_cut, Vertex_OnScreen, BSPnode_edge, Node_CreateFromVerts, Leaf } from "../src/BSP"
import { Vec2 } from "../src/clipping";

describe('I need to seggregate interfaces, but make sure they in combination the recreate the old.', () => {
	it('check vertex', () => {
		let bn = new BSPnode(4711)
		expect(bn.ID).to.equal(4711)

		let v = new Vertex_OnScreen()
		v.xy = new Vec2([[452, 582]])
		const n = v.normalize();
		expect(n[0]).to.equal(452)

		let ec = new Edge_cut(v)
		expect(ec.e).to.null

		expect(ec.c.xy.v[0]).to.equal(452)

		let ev = new Vec2([[1, 1]])
		let ed = new BSPnode_edge()
		ed.xy = ev
		ed.z = 1

		let d = ed.decide(v)
		expect(d).to.above(0)

	})

	it('check edge', () => {
		let bn = new BSPnode(4711)
		expect(bn.ID).to.equal(4711)


		const edge_to_be_inserted = new BSPnode_edge() // when test pass, continue to refactor

		verts = [new Vertex_OnScreen(), new Vertex_OnScreen()]
		verts[0].xy = new Vec2([[-1, 0]])
		verts[1].xy = new Vec2([[+1, 0]])

		// cross product of the beam tree. Trying to optimize, but still 6 multiplications = 2+2+2
		const b = Node_CreateFromVerts(verts, edge_to_be_inserted, 4004);


		var verts: [Vertex_OnScreen, Vertex_OnScreen] = [new Vertex_OnScreen(), new Vertex_OnScreen()]
		let v = verts[0]
		v.xy = new Vec2([[0, -582]])
		let n = v.normalize();
		expect(n[1]).to.equal(-582)

		v = verts[1]
		v.xy = new Vec2([[0, +452]])
		n = v.normalize();
		expect(n[1]).to.equal(+452)

		let ev = new Vec2([[1, 0]])
		let ed = new BSPnode_edge()
		ed.xy = ev
		ed.z = 0
		ed.verts = verts // The old code needs this. I guess that the new code better uses Cuts. We should no need to care if we recognize the vertices from the current polygon (happens for edges in a mesh), or rather any vertex at all (happes for faces). Or should it? should I hide the cut_by_edge variable from the decide_edge() ?

		let node = new BSPnode(-5000)
		node.edge = ed
		node.decide_edge(b, "857")   // fillstyle is the ID here: color on screen. HexCode. Huh, for edge??
		expect(node.children[0]).not.undefined
		expect(node.children[1]).not.undefined

		var lea = node.children[0];
		if (lea instanceof BSPnode) {
			expect(lea.ID).to.equal(4004)
			var cud = lea.cuts[0]; if (typeof cud !== 'undefined') expect(cud.c.normalize()[0]).to.equal(-1)
			var cud = lea.cuts[1]; if (typeof cud !== 'undefined') expect(cud.c.normalize()[0]).to.equal(0)
		} else {
			throw new Error("lea should be not be instance of Leaf")
		}

		var lea = node.children[1];
		if (lea instanceof BSPnode) {
			expect(lea.ID).to.equal(4004)
			var cud = lea.cuts[0]; if (typeof cud !== 'undefined') expect(cud.c.normalize()[0]).to.equal(0)
			var cud = lea.cuts[1]; if (typeof cud !== 'undefined') expect(cud.c.normalize()[0]).to.equal(1)
		} else {
			throw new Error("lea should be not be instance of Leaf")
		}

		// todo : are cuts set correctly?
		// todo : test recognition of vertices


	})

	// check face. Does it recognise its edges

	// borders. All the 2d clipping stuff for faces 
	// face should reuse the cuts of the edge when it is split by the edge

	// sector
});