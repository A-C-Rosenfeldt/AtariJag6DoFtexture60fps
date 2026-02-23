
import { expect, assert } from "chai";
import 'mocha'
import { BSPnode, Edge_cut, Vertex_OnScreen, BSPnode_edge, Node_CreateFromVerts, Leaf, Polygon_in_cameraSpace } from "../src/BSP"
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


		var edge_to_be_inserted = new BSPnode_edge() // when test pass, continue to refactor

		verts = [new Vertex_OnScreen(), new Vertex_OnScreen()]
		verts[0].xy = new Vec2([[-1, 0]])
		verts[1].xy = new Vec2([[+1, 0]])

		// cross product of the beam tree. Trying to optimize, but still 6 multiplications = 2+2+2
		const bb: BSPnode[] = []
		bb[0] = Node_CreateFromVerts(verts, edge_to_be_inserted, 4004);


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
		node.decide_edge(bb[0], "857")   // fillstyle is the ID here: color on screen. HexCode. Huh, for edge??
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


		// kinda difficult : test recognition of vertices
		//  only cuts can be. 
		// for performance, I need a separate infini precision engine
		//  inject dependency (into constructor like the ctx for draw()). But that needs code changes. First test everything else
		// After compilation, I need structs. So I need a C++ compiler with double inheritance and/or templates
		// For my TS algorithm check, I do not care. But I need an interface
		// cache.vectorOp([vec,vec])
		// if an edge or vertex owns this, we only need a list. Ah, and vec are not bare bones, but owned by edge and vertex. Do we care?
		// an external (non-clustered) service would need to look up based on two pointers

		// edge find is also difficult
		// I wonder where I will plug in the service
		// It has to guard access to the vector functions

		// So it looks like for now I can only test faces
		// Ah, I could check if the fail if not all edges had been inserted (todo)
		// but first: The happy path: Another edge cut by border, but at an angle. A third edge to connect the open side => triangle

		// Add triangle
		// even without recognition, the face needs to end up in both children ( we can check that )
		// Furthermore, the own edges need to place the face into only one of child.
		// this check will work for two reasons : I use fractions, cache seems to work (most of the time)
		// to discriminate between these, I need the injected service (mentioned above)

		edge_to_be_inserted = new BSPnode_edge() // when test pass, continue to refactor

		verts = [new Vertex_OnScreen(), new Vertex_OnScreen()]
		verts[0].xy = new Vec2([[+1, 0]])  // gotta keep math rotationial order
		verts[1].xy = new Vec2([[+1, 1]])
		bb[1] = Node_CreateFromVerts(verts, edge_to_be_inserted, 8008)
		node.decide_edge(bb[1], "857");
		// so all verts on +
		const c1 = node.children[1]
		if (c1 instanceof BSPnode) {
			const cc: BSPnode = c1;
			expect(cc).not.undefined;
			expect(cc.children[1]).not.undefined
			expect(cc.children[0]).be.undefined  //  I think I don't saturate dangling leafs here
		}

		edge_to_be_inserted = new BSPnode_edge() // when test pass, continue to refactor

		verts = [new Vertex_OnScreen(), new Vertex_OnScreen()]
		verts[0].xy = new Vec2([[+1, 1]])
		verts[1].xy = new Vec2([[-1, 0]])

		// cross product of the beam tree. Trying to optimize, but still 6 multiplications = 2+2+2
		bb[2] = Node_CreateFromVerts(verts, edge_to_be_inserted, 6502);

		node.decide_edge(bb[2], "857")   // Do I need a tree ? The tree does the whole polygon insert, but that create so much state at once. This test ficture replaces the method in the tree class
		// No idea why I push down a fill style onto edges. Perhaps a stroke? Or for debugging. So basically ID?

		// Now to fully reproduce insertPolygon: the face!
		const p = new Polygon_in_cameraSpace()
		p.edges_in_BSP = bb.map(n => n.edge)
		p.fillStyle = "654"
		node.decide_face(p)

		// the test should call .Draw ? 
		// Or is there a shorter way to describe a test in a tree?
		// depth first search
		// record the indent ( like in NAV ) on the old code. Reproduce

		const just_reproduce = TreeToText(node) // a future test should be one triangle behind another. But right now it does not work. Vertex and Edge recognition is more important. In the test string, the leaves then have different colors

		const c2 = node.children[1]
		if (c1 instanceof BSPnode) {
			const cc: BSPnode = c1;
			expect(cc).not.undefined;
			expect(cc.children[1]).not.undefined
			expect(cc.children[0]).be.undefined  //  I think I don't saturate dangling leafs here
		}

	})

	var TreeToText = function (b: BSPnode, level = 0): string {
		const c = b.children
		for (let i = 0; i < 2; i++) {
			const ci = c[i];
			if (typeof ci !== 'undefined') {
				if (ci instanceof BSPnode) {
					const t = TreeToText(ci, level + 1)
				} else {
					if (ci instanceof Leaf) {
						return "(" + level.toString() + ":" + ci.fillStyle + ")"
						//const t=TreeToText(ci,level+1)
					}
				}
			}
		}
		return ""
	}

	// check face. Does it recognise its edges

	// borders. All the 2d clipping stuff for faces 
	// face should reuse the cuts of the edge when it is split by the edge

	// sector
});