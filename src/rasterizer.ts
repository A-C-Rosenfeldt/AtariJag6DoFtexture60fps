// checks for overdraw
// rasterizes into canvas
// May include a z check or later even some antialias, interpolation
// but I should stick to Jaguar blitter capabilities
// I want SrcShade. There is a bug in z-buffer which makes it not compatible to srcShade
// Also pixel mode z-buffer is too slow. I have to JRISC SRAM free for cache, but color RAM
// Why don't people not always use color RAM?
// z resolution needs to happen in beam tree

class Span{
	// Jaguar innerloop does not waste energy on abort criterium
	// It wants integer x range

	render(x:number[], texture_base:number[],texture_delta:number[] /* vec2 ? */){

	}
}

class Polygon {
	vertex_to_vertex(){}
	vertex_to_clip(up:boolean){}
	clip_to_clip(){}


}


class Mapper{
	affine(){
		Span.render();
	}
	span(){
			// Maybe start with "The hidden below": Do end points exaclty and then span. Then add Quake subspans?
	}
	constZ(){ //On Jaguar due to pixel mode this seems to be fastest. Longest blitter runs. Lowest CPU burden. Fits into the Doom minimize overdraw and blitter command theme
		// this would need calculations above this for the horizon
		// also check if Jaguar can really draw diagonals.
		// to minimize splits, they better are only introduced when needed. For example tiles (2d vectors and decals) need splits anyway. Decals (examples: 5* , hexagon) need a beam tree
		// so we have the real const z which governs split (2^n spans). The approx const z ( horiztontal, vertical, diagonal ) for the blitter
		// even if diagonal does not work, the other two are more important anyway
	}
	subsivison(screen:Point_Tex2[]){ // guess I have to abuse the type system to mark the basis ( marker interface , attribute  :-(  )
		screen.sort(s=>s.point[1])
		let blocks=[(screen[1].point[0]-screen[0].point[0])>>3 ]
		if (slope ==0 || y[0]==y[1]) {
		// bounding box . Due to clipping on the screen borders .. Screen needs to be so that the control points span. have some border. Or yeah, let the grid snape 1 around. Only use
		}else{
			// try to fit a block in one of the three corners


		// I want a cheap transistion from affine to this ( and only use points inside )
		// Nobody sees any jumps in the heat of the action or due to stutters on vintage hardware
		// center grid on the bounding box

		blocks[1]=3 // todo find x min max
		// slope -> array of xs -> all corners as control point candidate -> fraction histogram  (in 2d)
		// merge leafs before blocks
		}
	}
}