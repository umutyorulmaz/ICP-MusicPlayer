import {
  $query,
  $update,
  Record,
  StableBTreeMap,
  Vec,
  match,
  Result,
  nat64,
  Principal,
  ic,
  Opt,
} from "azle";

import { v4 as uuidv4 } from "uuid";

type Song = Record<{
  id: string;
  title: string;
  singer: string;
  owner: Principal;
  favSong: Vec<string>;
  favCounter: number;
  createdAt: nat64;
  updatedAt: Opt<nat64>;
}>;

type SongInfo = Record<{
  title: string;
  singer: string;
  album: string;
  producer: string;
}>;
const playList = new StableBTreeMap<string, Song>(0, 44, 1024);

$query;
export function getList(): Result<Vec<Song>, string> {
  return Result.Ok(playList.values());
}

$update;
export function shuffleList(): Result<Vec<Song>, string> {
  const originalPlaylistResult = getList();

  if (originalPlaylistResult.Ok) {
    const originalPlaylist = originalPlaylistResult.Ok;

    // Deep copy the original playlist to avoid modifying it directly
    const shuffledPlaylist = [...originalPlaylist];

    // Shuffle the copied playlist
    for (let i = shuffledPlaylist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPlaylist[i], shuffledPlaylist[j]] = [
        shuffledPlaylist[j],
        shuffledPlaylist[i],
      ];
    }

    return Result.Ok(shuffledPlaylist);
  } else {
    return Result.Err(originalPlaylistResult.Err);
  }
}

$query;
export function getSong(id: string): Result<Song, string> {
  return match(playList.get(id), {
    Some: (song) => Result.Ok<Song, string>(song),
    None: () => Result.Err<Song, string>(`a song with id=${id} not found`),
  });
}
$update;
export function addSong(songinfo: SongInfo): Result<Song, string> {
  const song: Song = {
    id: uuidv4(),
    createdAt: ic.time(),
    updatedAt: Opt.None,
    favCounter: 0,
    favSong: [],
    owner: ic.caller(),
    ...songinfo,
  };
  playList.insert(song.id, song);
  return Result.Ok(song);
}
$update;
export function markAsFav(id: string): Result<Song, string> {
  return match(playList.get(id), {
    Some: (song) => {
      let favSong: Vec<string> = song.favSong;
      // checks if user liked the song
      if (favSong.includes(ic.caller().toString()) && song.favCounter != 0) {
        return Result.Err<Song, string>(
          `Already marked as fav song with id ${id}`
        );
      }
      // add user to the favSong array and increment the favCounter property by 1
      const updatedSong: Song = {
        ...song,
        favCounter: song.favCounter + 1,
        favSong: [...favSong, ic.caller().toString()],
      };
      playList.insert(song.id, updatedSong);
      return Result.Ok<Song, string>(updatedSong);
    },
    None: () => Result.Err<Song, string>(`Song with id=${id} not found`),
  });
}

$update;
export function removeFav(id: string): Result<Song, string> {
  return match(playList.get(id), {
    Some: (song) => {
      let favSong: Vec<string> = song.favSong;
      // checks if the song is liked or not
      if (!favSong.includes(ic.caller().toString()) || song.favCounter != 1) {
        return Result.Err<Song, string>(`Not marked as fav song with id ${id}`);
      }

      const updatedSong: Song = {
        ...song,
        favCounter: 0,
        favSong: [...favSong, ic.caller().toString()],
      };
      playList.insert(song.id, updatedSong);
      return Result.Ok<Song, string>(updatedSong);
    },
    None: () => Result.Err<Song, string>(`Song with id=${id} not found`),
  });
}

$update;
export function deleteSong(id: string): Result<Song, string> {
  return match(playList.remove(id), {
    Some: (deletedSong) => Result.Ok<Song, string>(deletedSong),
    None: () =>
      Result.Err<Song, string>(
        `Couldn't delete a song with id=${id}. Song not found.`
      ),
  });
}
// a workaround to make uuid package work with Azle
globalThis.crypto = {
  // @ts-ignore
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};
