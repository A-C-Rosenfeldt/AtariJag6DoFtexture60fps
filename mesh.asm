;Bresenham
;params(
; linecount ->2
; x -> 3
; deltaX -> 4
;)


less_jumps:
SUBQ 1,2
JR C, return

{

ADD 4,3
ADD 0,1  ; Bresenham
; pipeline. Maybe do both edges at once like those two z values
JR N,less_jumps  

SUBQ 1,2
}
JR C, return
