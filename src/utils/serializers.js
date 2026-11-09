// Decides which user fields leave the server. Routes must send users through one of these helpers.
// Fields are listed one by one, so a field added to the data model later stays private by default.

// What other people can see. Never includes email, password hash or location.
export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    bio: user.bio,
    interests: user.interests,
    avatarColor: user.avatarColor,
    // Ghost Mode also hides when someone was last online.
    lastActive: user.ghostMode ? null : user.lastActive,
  };
}

// What a logged-in user can see about their own account. Only ever send this to that user.
export function selfUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    bio: user.bio,
    interests: user.interests,
    avatarColor: user.avatarColor,
    location: user.location,
    ghostMode: user.ghostMode,
    lastActive: user.lastActive,
    createdAt: user.createdAt,
  };
}
