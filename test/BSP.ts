
import { expect, assert } from "chai";
import 'mocha'
import { BSPnode } from "../src/BSP"

describe('I need to seggregate interfaces, but make sure they in combination the recreate the old.', () => {
	it('check the simple stuff', () => {
		let bn = new BSPnode(4711)
		expect(bn.ID).to.equal(4711)

	})
});