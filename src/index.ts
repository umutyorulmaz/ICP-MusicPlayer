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
  favSong: Vec<Principal>; // Store Principals of users who marked as favorite
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

// Error messages
const ERR_ALREADY_MARKED = "Already marked as fav song";
const ERR_SONG_NOT_FOUND = "Song not found";
const ERR_INVALID_PRICE = "Invalid price";

$query;
export function getList(): Result<Vec<Song>, string> {
  return Result.Ok(playList.values());
}

$query;
export function getSong(id: string): Result<Song, string> {
  return match(playList.get(id), {
    Some: (song) => Result.Ok<Song, string>(song),
    None: () => Result.Err<Song, string>(ERR_SONG_NOT_FOUND),
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
      // Check if the caller has already marked the song as a favorite
      if (song.favSong.includes(ic.caller())) {
        return Result.Err<Song, string>(ERR_ALREADY_MARKED);
      }

      // Add caller to the list of favorite users
      song.favSong.push(ic.caller());

      // Increment the favorite counter
      song.favCounter += 1;

      // Update the song
      playList.insert(song.id, song);

      return Result.Ok<Song, string>(song);
    },
    None: () => Result.Err<Song, string>(ERR_SONG_NOT_FOUND),
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
