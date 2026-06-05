#if defined _csx_easy_stats_included
	#endinput
#endif
#define _csx_easy_stats_included

#pragma reqlib csx_easy_stats

#if !defined MAX_SKILL_LEVEL_LENGTH
	const MAX_SKILL_LEVEL_LENGTH = 64
#endif

enum _:SKILL_DATA
{
	SKILL_VALUE,
	SKILL_LEVEL_NAME[MAX_SKILL_LEVEL_LENGTH],
	SKILL_LEVEL_HTML[MAX_SKILL_LEVEL_LENGTH]
}

enum _:CSX_EASY_STATS_DATA
{
	CSX_FRAGS,
	CSX_DEATHS,
	CSX_HS,
	CSX_TK,
	CSX_SHOTS,
	CSX_HITS,
	CSX_DAMAGE,
	CSX_RANK,
	CSX_MAX_STATS,
	CSX_ASSIST = HIT_RIGHTLEG +1,
	CSX_SKILL = CSX_ASSIST +1,
	CSX_GAMETIME = CSX_SKILL +1,
	CSX_LASTCON = CSX_GAMETIME +1,
	CSX_MAX_BODYHITS = CSX_LASTCON +1
}

// Возвратит позицию игрока.
native csx_get_user_rank(index)

// Возвратит кол-во ассистов игрока.
native csx_get_user_assist(index)

// Возвратит скилл игрока.
native csx_get_user_skill(index)

// Возвратит игровое время игрока.
native csx_get_user_gametime(index)

// Возвратит время последнего подключения игрока.
native csx_get_user_last_connection(index)