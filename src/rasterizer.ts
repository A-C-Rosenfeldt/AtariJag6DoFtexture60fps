// The rasterizer needs to projected points from the beam tree. The tree is the start, and the polygon only lives in the leaf
// I think that most polygons in a dense mesh are split by their neighbours. I would need extra code to check for back faces. This does neither fit into the MVP nor the cache
// So I guess that I can go full tree. Still need to switch cases per vertex: Projected, vs cut of two edges, though do I, both are rationals. Ah, but with one x and y share w. Even this is the same for both.
// A scanline oriented rasterizer first only wants the y range.
// It is weird to use a box and check each pixel independently, but it is not so weird to use a whole scanline and then find the edges without delta values from previous scanline (MVP).
// So I enter Y, then some MUL and DIV and gives me two x. Their integer part may be different. So a while loop (additional branch in JRISC .. basically jump to the end of the loop first ).
// Now yeah indeed for the following lines I can use delta for the MUL part and even the DIV part. If I have more than one line, no division by zero happens here. I only use slopes for more than 2 lines per trapez.
// Same for X: I calculate the first and last pixel. Ah, the blitter wants slope already with two pixels. So it is different. Though the slope is ridicoulous
// I could write JRISC to .. ah I don't have space in the cache. Yeah, so slope starting with two pixels it is.
// For subspan perspective correction, DIV is just fast enough. No need for LUT or shift cases (and not space in cache).

// Polygon first would mean to sort y of all fragments of a polygon split into the leafs. Then I need a list of x values. Sort again. When I do this in registers or even within the cache,
// there is a limit. So add fragment, check for overflow, roll back. So I should probably start from the leafs.
// Even if I use a 2d tree, the int(cut.y) is the result of a division.
// So the viewing frustum starts the tree
// cutting has to happen in 3d here, even if we use a 2d tree. At least the near plane needs to be processed in 3d.
// The Jaguar SDK code cuts the polygon to the frustum like the frustum was a tree.
// Can I use the fast track to avoid cuts which are themself cut off? We can on the frustum because we know that we broke the symmetry ..ah no we can do in convex, but we cannot on arbitrary trees. 
// But even then we don't gain to much. Cuts along the edge need divisions or a lot of mul before we can sort them. At least we can wait with U and V?
// Like maybe I should not cut UV along any edge. Just ray trace the pixels like in Thief or Mode-7 .
// we should not double cut for UV. So even with cutting, wait for the final cut. For each cut refer to the original vertices. Throw away the preliminar results.
// Do we care if where an edge passes the vertex (corner) of a clipping polygon? This sign tells where to cut. Have to check with the camera position.
// On the back mirror of the frustum the signs change.

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
	sort_y(a,b,c){ // no life sort. Only program pointer. Struct will be sorted in branch
		if (a>b){
			if (c > a);
			else;
				fill a
				if (c<b);
				else;
		}else{

		}
	}
	sort_slope(){}

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