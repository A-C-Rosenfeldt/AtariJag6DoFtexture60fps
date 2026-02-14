
import { expect, assert } from "chai";
import 'mocha'
import { BSPnode, Edge_cut, Vertex_OnScreen, BSPnode_edge } from "../src/BSP"
import { Vec2 } from "../src/clipping";

describe('I need to seggregate interfaces, but make sure they in combination the recreate the old.', () => {
	it('check the simple stuff', () => {
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

	// it('interaction', () => {



	// })	
});