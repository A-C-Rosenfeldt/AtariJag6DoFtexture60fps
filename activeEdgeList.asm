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


;Sort
;Good old bubble sort seems to be best suited to work in the register file. It is always the same, and then a loop over it. MVTA is great for swap.
; Branch needs two nops because double branch is not allowed due to bug. We could interleave the next test with the previous swap. Twice the code size
; If we have slots for load, we could even do selection sort.
; Selection sort and insertion sort go more like. CMP loadq branch . Store is basically free. Selection sort is thus cheap. Read from regs.
; The problem here is that I need multiple passes, no matter what
; Small bubble sort unrolled and interleaved with register load store for the backbuffer is probably very fast.
; But this does not work with variable buffer size from quicksort
;Since branches are so super expensive in JRISC, tree structures win.
;Roughly quicksort is good because it is stable.
;To get a balanced tree, MergeSort is better. Register-based, unrolled may be possible. Though it has pointers on the source arrays!
;quicksort works well with SRAM. We only need to store when we need to swap.
;When a quicksort range < register   ->   bubble sort Jump (RN) at the end only covers as many registers as needed
;The nice thing about quicksort is that it catches the occasional large slope.

;I could not find a stable algorithm to first sort in blocks. Then sort by block-start ? Gives many overlapping regions for merge-meets-selection sort (pulling from SRAM). No recursion, sadly

;Heapsort .. tja hat einen Heap. Anscheinend wird hier viel geswapt, aber nicht so schlimm wie bei bubble sort. In die unteren Äste reicht man eher selten rein, die können also im SRAM stehen.
;Take in last element is great for in-place, but memory is only my second concern. Feels weird to bubble up an element from down below.
;If I have a tree and it should live from one scanline to the next, I feel like I could flow values through It
;So a totally sorted binary tree with values at nodes and leafs. We move down one scanlin, and sort at each node ( maybe if I use registers: Not binary )
;Now Merge happens at the parent node. I feel like I have just recreated block + merge.

;Heapsort may be unrolled so that each node of the tree is a line of code.
;branches go down, swap register, go up again.
;We store the winner, so no inplace constraint and great for interleave. Just clear the register. Termination if we pull a 0 or <0.
;We fill the heap with the previous data top down breadth first to reduce the number of swaps ( AND BRANCHES!)
;Extra code rotates this initial tree nodes bottom up to get max value
;How do I keep up heap condition if I pull up a value? Go down the tree and promote. No Idea why smooth sort is said to be slow.
;Maybe it is allow to check for 0 and branch. OR stay check for sign of the omp and here branch or not. Just don't double-hop! 