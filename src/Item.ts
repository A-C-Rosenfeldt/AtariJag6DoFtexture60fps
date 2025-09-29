import { Vec2 } from './clipping';

// // I tried nullable properties ...
// class PointPointing{
// 	position: Array<number>
// 	vector: Vec2
// 	reverse:boolean
// 	border: any;
// }
// but ...Aparently, with parallel consideration, I need polymorphism very badly

export interface Item {
}
export class Edge_on_Screen implements Item {
}
// class Edge_hollow extends Edge_on_Screen {
// }

export class Edge_w_slope extends Edge_on_Screen {
	private _gradient: Vec2;
	public get gradient(): Vec2 {
		return this._gradient;
	}
	public set gradient(value: Vec2) {
		// Slope is from vertex to border.  Vertex to vertex around the clock. Horizon is trying to mimic around the clock. But really, slope is never top down. Ah later I convert around-the-clock to top down.
		// So anyways: slope can be upwards until we know which side ( left vs right) we are on
		// if (value.v[0]<0){
		// 	throw new Error("Gradient along x needs to be positive, to make up for the negative Akku and the negative x.fraction <=floor.  ")
		// }
		this._gradient = value;
	}
}

export class Edge_Horizon extends Edge_w_slope {
	bias: number;
}

export abstract class Point implements Item {
	abstract get_y(): number;
}
export class vertex_behind_nearPlane implements Item {
}
// Just as projected

export class Vertex_OnScreen extends Point {
	private _position = new Array<number>();
	public get position() {
		return this._position;
	}
	public set position(value) {
		if (isNaN(value[0]) || isNaN(value[0])) throw new Error(" value is nan");
		this._position = value;
	}
	get_y() { return Math.ceil(this.position[1]); } // subpixel correction and drawing with increasing y mandates ceil() instead of my standard floor(). +1 wleads to minimal glitches. Ah, why risk. Addq 1. SAR .

	// I use the vector constructor to do this. Seems like a silly hack?
	fraction() { return this.position.map(p => p - Math.floor(p)); } // AI thinks that this looks better than % 1. Floor is explicit and is the way JRISC with twos-complemnt fixed point works
}
export class Corner extends Point {
	static screen: number[];
	static throttle = 10000;
	corner: number;
	get_one_digit_coords() {
		const r = [(this.corner + 1 & 2) - 1, (this.corner + 0 & 2) - 1];
		return r;
	} // Todo: UnitTest
	get_y() {
		// if (Corner.throttle--<0) {
		// 	throw new Error("endless loop")}
		const y = Corner.screen[1] * ((this.corner & 2) - 1);
		// console.log("Corner ",this.corner," -> y", y)
		// if (isNaN(y)) {
		// 	let lll=0
		// }
		return y;
	}
	constructor() {
		super();
		this.corner = -1;
	}
}
export class Onthe_border extends Point {
	// the edge after the corner in mathematical sense of rotation
	private _border: number;
	public get border(): number {
		return this._border;
	}
	public set border(value: number) {
		if (value < 0) throw new Error("<0");
		if (value > 3) throw new Error(">3");
		if (!Number.isInteger(value)) throw new Error("!Number.isInteger");
		this._border = value;
	}
	get_one_digit_coords() {
		let t = [(this.border & 2) - 1, 0];
		if ((this.border & 1) == 0) return t;
		return [0, t[0]];
	}
	private _pixel_ordinate_int: number;
	public get pixel_ordinate_int(): number {
		return this._pixel_ordinate_int;
	}
	public set pixel_ordinate_int(value: number) {
		if (isNaN(value) || value < -160 || value > 160) {
			throw "out of range for all axes. btw, border is " + this.border + " value is " + value;
		}
		this._pixel_ordinate_int = value;
	}
	z_gt_nearplane: boolean;
	half_screen: any;

	get_y() {

		return (this.border & 1) == 0 ? this.pixel_ordinate_int : this.half_screen[1] * ((this.border & 2) - 1);
		// this has to follow the generation of these objects. This was the orignal shortes formulation. It failed
		// return this.border & 1 ? this.pixel_ordinate_int : this.half_screen[this.corner & 1] * (1 - (this.corner & 2))
	}

	constructor(half_screen: number[]) {
		super();
		this.half_screen = half_screen;
	}
}

// Even without lazy precision, clipping and mapping tends to go back to the rotated vertex

export class Vertex_in_cameraSpace {
	inSpace: Array<number>; // Not a Vec3 because projection deals so differently with the z-component
	outside: boolean;
	// NDC would not need this and minimize state, but for debugging (getter?!) , okay for JRISC we use bits. 32 vertex limit for polygons is okay.
	outside_of_border: number; // border = bit pos . my edge code uses patt |= 1 << border to find edges which are in front and in back of border beams .. I never debugged  check z fixed corner,edge directio, sweep camera-vertex => z does not flip sign. 2d field or just ^= <<1
	add_outside_rect = (i: number) => {
		this.outside_of_border |= 1 << (i | (Math.sign(this.inSpace[i]) + 1 & 2));
	};
	onScreen: Vertex_OnScreen; //Point //Pointing
	constructor(inSpace: Array<number>) {
		this.inSpace = inSpace;
	}
}
