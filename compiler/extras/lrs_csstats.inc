#if defined _lrs_csstats_included
	#endinput
#endif
#define _lrs_csstats_included

#pragma reqlib lrs_csstats

#if !defined MAX_RANK_LEVEL_LENGTH
	const MAX_RANK_LEVEL_LENGTH = 64
#endif

enum _:LRS_CSSTATS_DATA
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

// Эвент нового уровня.
// Вызывается когда игрок получает новое звание.
forward lrs_player_level_up_event(index)

// Возвратит максимальный уровень.
native lrs_get_max_lvl()

// Возвратит кол-во опыта игрока.
native lrs_get_user_exp(index)

// Возвратит номер уровня игрока.
native lrs_get_user_lvl(index)

// Возвратит кол-во опыта игроков.
native lrs_get_exp_for_stats(st[CSX_MAX_STATS])

// Возвратит номер уровня игроков.
native lrs_get_lvl_for_stats(st[CSX_MAX_STATS])

// Возвратит кол-во опыта по его уровню.
native lrs_get_exp_for_lvl(lvlnum)

// Возвратит номер уровня по его опыту.
native lrs_get_lvl_for_exp(expnum)

// Возвратит кол-во опыта до следующего уровня.
native lrs_get_exp_to_next_lvl(lvlnum)

// Возвратит звание игрока.
native lrs_get_lvl_name(lvlnum, level[], len, idLang = 0)