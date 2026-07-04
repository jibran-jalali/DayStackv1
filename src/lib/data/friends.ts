import "server-only";

import { and, asc, desc, eq, ilike, inArray, ne, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import { friend_connections, users } from "@/db/schema";
import { deriveDisplayName } from "@/lib/daystack";
import type {
  FriendConnectionRecord,
  FriendConnectionSummary,
  FriendSearchResult,
  FriendsSnapshot,
  ParticipantProfile,
  ProfileRecord,
} from "@/types/daystack";

type DayStackDb = NonNullable<ReturnType<typeof getDb>>;

function getRequiredDb(): DayStackDb {
  const db = getDb();

  if (!db) {
    throw new Error("Database is not configured.");
  }

  return db;
}

function mapProfile(profile: Pick<ProfileRecord, "email" | "full_name" | "id">): ParticipantProfile {
  return {
    email: profile.email,
    fullName: deriveDisplayName(profile.full_name, profile.email ?? undefined),
    id: profile.id,
  };
}

function getPairIds(leftUserId: string, rightUserId: string) {
  return leftUserId < rightUserId
    ? { userOneId: leftUserId, userTwoId: rightUserId }
    : { userOneId: rightUserId, userTwoId: leftUserId };
}

function isUserInConnection(userId: string, connection: Pick<FriendConnectionRecord, "user_one_id" | "user_two_id">) {
  return connection.user_one_id === userId || connection.user_two_id === userId;
}

function mapConnectionSummary(
  currentUserId: string,
  connection: FriendConnectionRecord,
  profilesById: Map<string, ParticipantProfile>,
): FriendConnectionSummary | null {
  const otherUserId = connection.requester_id === currentUserId ? connection.addressee_id : connection.requester_id;
  const otherUser = profilesById.get(otherUserId);

  if (!otherUser) {
    return null;
  }

  return {
    acceptedAt: connection.accepted_at,
    createdAt: connection.created_at,
    id: connection.id,
    otherUser,
    requesterId: connection.requester_id,
    status: connection.status,
    updatedAt: connection.updated_at,
  };
}

export async function fetchFriendsSnapshot(userId: string): Promise<FriendsSnapshot> {
  const db = getRequiredDb();
  const connections = await db
    .select()
    .from(friend_connections)
    .where(or(eq(friend_connections.user_one_id, userId), eq(friend_connections.user_two_id, userId)))
    .orderBy(desc(friend_connections.updated_at), desc(friend_connections.created_at));

  if (connections.length === 0) {
    return {
      friends: [],
      incoming: [],
      outgoing: [],
    };
  }

  const profileIds = [
    ...new Set(
      connections.map((connection) =>
        connection.requester_id === userId ? connection.addressee_id : connection.requester_id,
      ),
    ),
  ];
  const profiles = await db
    .select({
      email: users.email,
      full_name: users.full_name,
      id: users.id,
    })
    .from(users)
    .where(inArray(users.id, profileIds));
  const profilesById = new Map(profiles.map((profile) => [profile.id, mapProfile(profile)]));
  const snapshot: FriendsSnapshot = {
    friends: [],
    incoming: [],
    outgoing: [],
  };

  connections.forEach((connection) => {
    const summary = mapConnectionSummary(userId, connection, profilesById);

    if (!summary) {
      return;
    }

    if (connection.status === "accepted") {
      snapshot.friends.push(summary);
      return;
    }

    if (connection.addressee_id === userId) {
      snapshot.incoming.push(summary);
      return;
    }

    snapshot.outgoing.push(summary);
  });

  return snapshot;
}

export async function searchFriendCandidates(userId: string, query: string, limit = 8): Promise<FriendSearchResult[]> {
  const db = getRequiredDb();
  const normalizedQuery = query.trim();
  const conditions = [ne(users.id, userId), eq(users.status, "active")];

  if (normalizedQuery.length > 0) {
    conditions.push(or(ilike(users.full_name, `%${normalizedQuery}%`), ilike(users.email, `%${normalizedQuery}%`))!);
  }

  const candidateRows = await db
    .select({
      email: users.email,
      full_name: users.full_name,
      id: users.id,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(asc(users.full_name), asc(users.email))
    .limit(limit);

  if (candidateRows.length === 0) {
    return [];
  }

  const candidateIds = candidateRows.map((candidate) => candidate.id);
  const connectionRows = await db
    .select()
    .from(friend_connections)
    .where(
      or(
        and(eq(friend_connections.user_one_id, userId), inArray(friend_connections.user_two_id, candidateIds)),
        and(eq(friend_connections.user_two_id, userId), inArray(friend_connections.user_one_id, candidateIds)),
      ),
    );
  const connectionsByOtherUserId = new Map(
    connectionRows.map((connection) => [
      connection.user_one_id === userId ? connection.user_two_id : connection.user_one_id,
      connection,
    ]),
  );

  return candidateRows.map((candidate) => {
    const connection = connectionsByOtherUserId.get(candidate.id);
    const profile = mapProfile(candidate);

    if (!connection) {
      return {
        ...profile,
        connectionId: null,
        friendshipStatus: "none",
      };
    }

    return {
      ...profile,
      connectionId: connection.id,
      friendshipStatus:
        connection.status === "accepted"
          ? "accepted"
          : connection.requester_id === userId
            ? "outgoing"
            : "incoming",
    };
  });
}

export async function sendFriendRequest(userId: string, addresseeId: string) {
  const db = getRequiredDb();
  const targetUserId = addresseeId.trim();

  if (!targetUserId || targetUserId === userId) {
    throw new Error("Choose another active user to add as a friend.");
  }

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, targetUserId), eq(users.status, "active")))
    .limit(1);

  if (!targetUser) {
    throw new Error("This user is not available for friend requests.");
  }

  const { userOneId, userTwoId } = getPairIds(userId, targetUserId);
  const now = new Date().toISOString();
  const [connection] = await db
    .insert(friend_connections)
    .values({
      addressee_id: targetUserId,
      created_at: now,
      id: crypto.randomUUID(),
      requester_id: userId,
      status: "pending",
      updated_at: now,
      user_one_id: userOneId,
      user_two_id: userTwoId,
    })
    .onConflictDoNothing()
    .returning();

  if (connection) {
    return connection;
  }

  const [existingConnection] = await db
    .select()
    .from(friend_connections)
    .where(and(eq(friend_connections.user_one_id, userOneId), eq(friend_connections.user_two_id, userTwoId)))
    .limit(1);

  if (!existingConnection) {
    throw new Error("Friend request could not be created.");
  }

  if (existingConnection.status === "accepted") {
    throw new Error("You are already friends.");
  }

  if (existingConnection.addressee_id === userId) {
    return acceptFriendRequest(userId, existingConnection.id);
  }

  throw new Error("A friend request is already pending.");
}

export async function acceptFriendRequest(userId: string, connectionId: string) {
  const db = getRequiredDb();
  const now = new Date().toISOString();
  const [connection] = await db
    .update(friend_connections)
    .set({
      accepted_at: now,
      status: "accepted",
      updated_at: now,
    })
    .where(
      and(
        eq(friend_connections.id, connectionId),
        eq(friend_connections.addressee_id, userId),
        eq(friend_connections.status, "pending"),
      ),
    )
    .returning();

  if (!connection) {
    throw new Error("This friend request is no longer available.");
  }

  return connection;
}

export async function declineFriendRequest(userId: string, connectionId: string) {
  const db = getRequiredDb();
  const deletedRows = await db
    .delete(friend_connections)
    .where(
      and(
        eq(friend_connections.id, connectionId),
        eq(friend_connections.addressee_id, userId),
        eq(friend_connections.status, "pending"),
      ),
    )
    .returning({ id: friend_connections.id });

  if (deletedRows.length === 0) {
    throw new Error("This friend request is no longer available.");
  }
}

export async function removeFriend(userId: string, friendUserId: string) {
  const db = getRequiredDb();
  const { userOneId, userTwoId } = getPairIds(userId, friendUserId);
  const deletedRows = await db
    .delete(friend_connections)
    .where(
      and(
        eq(friend_connections.user_one_id, userOneId),
        eq(friend_connections.user_two_id, userTwoId),
        eq(friend_connections.status, "accepted"),
      ),
    )
    .returning({ id: friend_connections.id });

  if (deletedRows.length === 0) {
    throw new Error("Friendship not found.");
  }
}

export async function fetchAcceptedFriendIds(userId: string, candidateIds?: string[]) {
  const db = getRequiredDb();
  const baseCondition = and(
    eq(friend_connections.status, "accepted"),
    or(eq(friend_connections.user_one_id, userId), eq(friend_connections.user_two_id, userId)),
  );
  const connections = await db
    .select({
      user_one_id: friend_connections.user_one_id,
      user_two_id: friend_connections.user_two_id,
    })
    .from(friend_connections)
    .where(baseCondition);
  const friendIds = connections
    .filter((connection) => isUserInConnection(userId, connection))
    .map((connection) => (connection.user_one_id === userId ? connection.user_two_id : connection.user_one_id));
  const friendIdSet = new Set(friendIds);

  if (!candidateIds) {
    return friendIdSet;
  }

  return new Set(candidateIds.filter((candidateId) => friendIdSet.has(candidateId)));
}

export async function assertAcceptedFriendParticipants(userId: string, participantIds: string[]) {
  const uniqueIds = [...new Set(participantIds)];

  if (uniqueIds.length === 0) {
    return;
  }

  if (uniqueIds.includes(userId)) {
    throw new Error("You cannot tag yourself as a meeting participant.");
  }

  const acceptedFriendIds = await fetchAcceptedFriendIds(userId, uniqueIds);
  const invalidIds = uniqueIds.filter((participantId) => !acceptedFriendIds.has(participantId));

  if (invalidIds.length > 0) {
    throw new Error("You can only mention accepted friends in meetings.");
  }
}
