; so how slow is the active edge list for "fight4life models".  solid polygons total < 256

;per frame
;we save the backbuffer. Let's use RAM for speed
;Store vertex at y in the orginial backbuffer. List grows up to 32 entries. Spill over goes into global?
;ListCounts/byte are strored in SRAM


;It seems that I need to read a lot per scanline

LoadP vertex xy w?  -> edge going towards larger y
Load uv 
LoadP edge current {x,u,v}  -> next edge starting here, face 
Load pointersToVertices
LoadP Face 
	UV Matrix  (inverse)

sort new vertices in current scanline
active_edge_list.{
	remove edge where lower vertex was in last scanline
	add slopes ( and maybe do a Bresenham for edge function and UV for both faces (if not culled))
	bubble sort
		check again like in bubble sort:
		register version: Sort using registers per page ( every 32 values in RAM? )
		check for page overlap ( and load into registers doing this)
			Merge sort going over two pages
		If any changes_were_needed ? goto check again like in bubble sort
}
MergeSort with vertices in current scanline . If -2<slope<2
	? bubble sort
	! quicksort  ; I would rather limit this to one register count. Maybe the buble sort is the real spill over?
		go round robin an replace an edge here if the new edge has larger slope, otherwise new edge ends up in bubble sort.
			if no new vertex arrives, at least compare two exisiting edges
Insert Spill-over?


;Going over the scanline
recheck:
;for current and next vertex find closest z ( largest w)
differnt face?
	Use division to find crossing point. Goto recheck

Face changed?
	Draw last face ( merges over hidden vertices)
		for limits
			if own_edge
				? use UV from them
				! MUL to get UV
		may split into 16px segments for perspective. There is no synergy with the other splits ( there may be in the beam tree)
		UV slopes
			last segment

any transparency in front sorted by z
	;No: May I want to scan for transparent pixels
	;Artist is responsible for slow down