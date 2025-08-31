In pool_matching_service

we will check if user is staff or app user

if user is staff, they will always need to connect with app users who are their same pool_id and seq_id. Otherwise, keep them in wait queue.


if user is app user

def pool() to get user pool.
By default they will start with sequence whose position is 1st in their pool.


when to change sequence?
sequence has video count inside it.

Each user need to watch that and when its fulfilled, its sequence will change. we should know user current sequence and videos count, you can store in user store or local storage. if user comes any other day, he can start from 0.
On swipe, we will show next content.


How to show what to user?
we will check user current sequence.
we will check app user available from same pool or /staff/videos  from specific sequence of pool.
whatever found will be displayed to user. We can give priority to app users, then to staff and then to video. If none found, keep on loading icon we show. On swipe we will increase video count of that user for that sequence, if it equals that sequence videos count, we move to next sequence.
