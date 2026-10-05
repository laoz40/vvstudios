import {
	claimClientAssetsEmail as claimClientAssetsEmailLib,
	saveClientAssetsEmailResult as saveClientAssetsEmailResultLib,
	saveClientDrivePermission as saveClientDrivePermissionLib,
	saveClientDrivePermissionsStatus as saveClientDrivePermissionsStatusLib
} from "#convex/lib/drive/driveClientAccess";
import {
	ensureBookingDriveClientId as ensureBookingDriveClientIdLib,
	syncBookingDriveClientIdFromSession as syncBookingDriveClientIdFromSessionLib
} from "#convex/lib/drive/driveBookingDriveClient";
import {
	clearSavedDriveFolder as clearSavedDriveFolderLib,
	saveDriveClientAssetsFolder as saveDriveClientAssetsFolderLib,
	saveDriveChildFolder as saveDriveChildFolderLib,
	saveDriveClientFolder as saveDriveClientFolderLib,
	saveDrivePackageFolder as saveDrivePackageFolderLib,
	saveDriveSessionFolder as saveDriveSessionFolderLib,
	saveDriveSetupResult as saveDriveSetupResultLib
} from "#convex/lib/drive/driveFolders";
import {
	allocateClientSessionNumber as allocateClientSessionNumberLib,
	allocatePackageSessionNumber as allocatePackageSessionNumberLib
} from "#convex/lib/drive/sessionFolders/allocateNumbers";
import { clearSessionDriveDb as clearSessionDriveDbLib } from "#convex/lib/drive/sessionFolders/clearSessionRecords";
import { getDriveSetup as getDriveSetupLib } from "#convex/lib/drive/driveLookup";
import {
	claimEditorAssignmentEmail as claimEditorAssignmentEmailLib,
	clearPreviousEditorDriveAccess as clearPreviousEditorDriveAccessLib,
	getEditorDriveAccessToRemove as getEditorDriveAccessToRemoveLib,
	getEditorDriveSetup as getEditorDriveSetupLib,
	getFailedEditorRemoval as getFailedEditorRemovalLib,
	markPreviousEditorRemovalFailed as markPreviousEditorRemovalFailedLib,
	saveEditorAssignmentEmailResult as saveEditorAssignmentEmailResultLib,
	saveEditorDrivePermission as saveEditorDrivePermissionLib,
	saveEditorDrivePermissionsStatus as saveEditorDrivePermissionsStatusLib
} from "#convex/lib/drive/driveEditor";

export const getDriveSetup = getDriveSetupLib;

export const saveDriveClientFolder = saveDriveClientFolderLib;

export const saveDriveSessionFolder = saveDriveSessionFolderLib;

export const syncBookingDriveClientIdFromSession = syncBookingDriveClientIdFromSessionLib;

export const saveDrivePackageFolder = saveDrivePackageFolderLib;

export const allocatePackageSessionNumber = allocatePackageSessionNumberLib;

export const allocateClientSessionNumber = allocateClientSessionNumberLib;

export const linkBookingDriveClient = ensureBookingDriveClientIdLib;

export const saveDriveClientAssetsFolder = saveDriveClientAssetsFolderLib;

export const saveDriveSetupResult = saveDriveSetupResultLib;

export const clearSavedDriveFolder = clearSavedDriveFolderLib;

export const saveDriveChildFolder = saveDriveChildFolderLib;

export const saveClientDrivePermission = saveClientDrivePermissionLib;

export const saveClientDrivePermissionsStatus = saveClientDrivePermissionsStatusLib;

export const claimClientAssetsEmail = claimClientAssetsEmailLib;

export const saveClientAssetsEmailResult = saveClientAssetsEmailResultLib;

export const getEditorDriveSetup = getEditorDriveSetupLib;

export const getEditorDriveAccessToRemove = getEditorDriveAccessToRemoveLib;

export const clearPreviousEditorDriveAccess = clearPreviousEditorDriveAccessLib;

export const markPreviousEditorRemovalFailed = markPreviousEditorRemovalFailedLib;

export const getFailedEditorRemoval = getFailedEditorRemovalLib;

export const saveEditorDrivePermission = saveEditorDrivePermissionLib;

export const saveEditorDrivePermissionsStatus = saveEditorDrivePermissionsStatusLib;

export const claimEditorAssignmentEmail = claimEditorAssignmentEmailLib;

export const saveEditorAssignmentEmailResult = saveEditorAssignmentEmailResultLib;

export const clearSessionDriveDb = clearSessionDriveDbLib;
