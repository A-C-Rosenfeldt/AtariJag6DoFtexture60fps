; small tris write phrases
; large tris write 4 stacked phrases
;; RWM .. no come on. Don't access phrases outside of triangle in external RAM!
;;; If code blows up, align tiles to the center vertex

;;;;;;;;;;; rasterize large triangles over 8x8 tiles  ( I start with affine .. perspective is later)
;; use bilinear if all corners are inside
;; maybe try 8x4 and 4x8 and 4x4
;; calculate 

; So we still separate in upper and lower triangle
; we floor and ceil the line to tile line
; we floor uper line and lower line of left edge
; we ceil  uper line and lower line of right edge
; loop over tiles. Check for each pixel if inside triangle
; not much space for other code paths, but tips could be done like small tries

;;;;;;; Call into the texture mapper

;; There is synergy between perspective correct texture mapping and these tiles
; So at vertices I multiply  U and V with Z and at the tile nodes I divide by W
; At the corner of the screen maybe I can just omit one divide ?



; tip
;scan line iterated -1,-1 
; to avoid code duplication around the vertices, I should always calculate all max 4 x [start|end] 8 registers
; so the loop is like always
; x values packed in high:low word
; scroll them through using MOVE
; scanline counter checks for 00 in lsb
;  => actually render scanline since last time
; stupid min max x
; then floor(x). Then in this block do the scanlines which encompass this block.  ( for almost horizontal shivers )
; minmx y
; blitter command
; x++ as long <= ceil xstarts 

; not only need I max(3) for vertices of triangle and ordinates of vertex
; I need minMax(4) .. 
; shift method again?
; 4 values can be sorted with fixed layout in mergeSort ( heap and qsort need pointer)
; sort two pairs 
; sort the mins and the maxs

; scanlines are iterated with a multiplied bresenham to jump +1 +3 -1 -1 +3
; so we know the x start and stop in tile coordinates
; within tile we know which of if any of the 3 edges is relevant. Split along x or y ?

; Tiles are align to the memory layout created by the Object Processor.
; The Jaguar has 2 MB
; 11 DRAM address pins -- so 4 MB would be possible?
; Controller
; MEMCON2 Memory Configuration Register Two F00002 RW
; Why is ther DRAM0 and DRAM1  at bits 0,1 and bits 4,5 ?
; I think columns means number of phrases within one row
;Specifies number of columns in DRAM0
;0 256
;1 512
;2 1024
;3 2048

;Vidoe mode
 VMODE Video Mode F00028 WO
1,2 0 CRY  MODE
; 320px horizontl   resolution.   Looks very complicated. 68k code in the SDK does this for us

;OLP Object List Pointer F00020 WO
;Branch
0-2 : 3 type
3-13: vEnd
14-15  2    vEnd < VC
24-42 link to stop object
;; direct im Anschluss
do{
	;Bit Mapped Object
	0-2 type 0
	3-13 ypos 0 of 480
	14-23 height in field-lines =240px -- As each line is displayed the height is reduced by one for non-interlaced displays or by two for interlaced displays.
		GPU reads this in a loop for VSYNC?
			Or VC Vertical Count F00006 RW
			 - VDB Vertical Display Begin F00046 WO
	24-42 LINK This defines the address of the next object. These nineteen bits replace bits 
	3 to 21 in the register OLP. This allows an object to link to another object 
	within the same 4 Mbytes.
	43-63 DATA This defines where the pixel data can be found. Like LINK this is a phrase 
	address. These twenty-one bits define bits 3 to 23 of the data address. This 
	allows object data to be positioned anywhere in memory. After a line is 
	displayed the new data address is written back to the object.

	0-11 xpos 0
	12-14 depth 4 16 bits/pixel
	15-17 PITCH/phrase  3   <=  front z back
	18-27 DataWidth/phrases  =   columns /4   ; for our 4x4px tiles
	28-37 IWIDTH/phrases   for clipping the rightmous Object
}while( < 320px )
;stop  ; This object stops object processing and interrupts the host. 
0-2 type=4
INT1 CPU Interrupt Control "enable "Register F000E0 RW ; we want no CPU interrupts, though. GPU maybe

; It may be possible to render a triangle strip and end one triangle at one (shared) vertex and proceed on the other triangle and check if tile can be kept

; small triangle mode without tiles  ( with z-buffer? )
; where the scanline is split in a binary fashion until all bits are opaque or clear
STOREP
STORE
STOREW Rn,(Rn)



;60 fps. draw some triangles directly
; LBUF Line Buffer F00800-0D9E RW

F03000 - F03FFF local RAM ;for the GPU interal RAM is always at